const mongoose = require('mongoose');

const campaignSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    trim: true
  },
  segment: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Segment',
    required: true
  },
  status: {
    type: String,
    required: true,
    enum: ['draft', 'scheduled', 'running', 'completed', 'failed'],
    default: 'draft'
  },
  messageTemplate: {
    type: String,
    required: true,
    default: 'Hi {{customerName}}, {{message}}'
  },
  messageContent: {
    type: String,
    required: true
  },
  scheduleDate: {
    type: Date
  },
  stats: {
    audienceSize: {
      type: Number,
      default: 0
    },
    sent: {
      type: Number,
      default: 0
    },
    failed: {
      type: Number,
      default: 0
    },
    lastUpdated: {
      type: Date
    }
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Add virtual field for communication logs
campaignSchema.virtual('communicationLogs', {
  ref: 'CommunicationLog',
  localField: '_id',
  foreignField: 'campaignId'
});

// Method to update campaign stats
campaignSchema.methods.updateStats = async function(sent, failed) {
  this.stats.sent = sent;
  this.stats.failed = failed;
  this.stats.lastUpdated = new Date();
  await this.save();
};

// Method to get campaign progress
campaignSchema.methods.getProgress = function() {
  const total = this.stats.audienceSize;
  const completed = this.stats.sent + this.stats.failed;
  return total > 0 ? (completed / total) * 100 : 0;
};

// Method to process campaign messages
campaignSchema.methods.processMessages = async function() {
  const Customer = mongoose.model('Customer');
  const CommunicationLog = mongoose.model('CommunicationLog');
  const Segment = mongoose.model('Segment');
  const vendorService = require('../services/vendorService');
  
  try {
    // Update campaign status
    this.status = 'running';
    await this.save();

    // Get segment with customers
    const segment = await Segment.findById(this.segment).populate('customers');
    if (!segment) {
      throw new Error('Segment not found');
    }

    // Initialize stats
    let sent = 0;
    let failed = 0;
    const batchSize = 50; // Process 50 messages at a time
    const customers = segment.customers;
    const totalCustomers = customers.length;

    // Update initial audience size
    this.stats.audienceSize = totalCustomers;
    await this.save();

    // Process customers in batches
    for (let i = 0; i < totalCustomers; i += batchSize) {
      const batch = customers.slice(i, i + batchSize);
      
      // Process each customer in the batch
      for (const customer of batch) {
        try {
          // Create personalized message
          const message = this.messageTemplate
            .replace('{{customerName}}', customer.name)
            .replace('{{message}}', this.messageContent);

          // Create communication log entry
          const log = new CommunicationLog({
            campaignId: this._id,
            customerId: customer._id,
            message,
            status: 'PENDING'
          });

          await log.save();

          // Send message through vendor service
          const result = await vendorService.sendMessage(message, customer);
          
          // Update log with success
          log.status = 'SENT';
          log.deliveryReceipt = {
            status: 'DELIVERED',
            timestamp: new Date(),
            messageId: result.messageId
          };
          await log.save();
          
          sent++;
          
          // Update campaign stats after each message
          this.stats.sent = sent;
          this.stats.failed = failed;
          this.stats.lastUpdated = new Date();
          await this.save();
          
        } catch (error) {
          console.error(`Error sending message to customer ${customer._id}:`, error);
          
          // Update log with failure
          const log = await CommunicationLog.findOne({ 
            campaignId: this._id, 
            customerId: customer._id,
            status: 'PENDING'
          });
          
          if (log) {
            log.status = 'FAILED';
            log.deliveryReceipt = {
              status: 'FAILED',
              timestamp: new Date(),
              errorMessage: error.message
            };
            await log.save();
          }
          
          failed++;
          
          // Update campaign stats after each failure
          this.stats.sent = sent;
          this.stats.failed = failed;
          this.stats.lastUpdated = new Date();
          await this.save();
        }
      }
    }

    // Update final campaign status
    this.status = 'completed';
    await this.save();

  } catch (error) {
    // Handle campaign-level error
    console.error('Campaign processing error:', error);
    this.status = 'failed';
    await this.save();
    throw error;
  }
};

const Campaign = mongoose.model('Campaign', campaignSchema);

module.exports = Campaign; 