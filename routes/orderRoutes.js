const express = require('express');
const Order = require('../models/order');
const Customer = require('../models/customer');

const router = express.Router();

// Get all orders
router.get('/', async (req, res) => {
  try {
    console.log('Fetching all orders...');
    const orders = await Order.find()
      .populate('customer', 'name email')
      .sort({ createdAt: -1 });
    console.log(`Found ${orders.length} orders`);
    res.json(orders);
  } catch (error) {
    console.error('Error fetching orders:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Error fetching orders',
      details: error.message
    });
  }
});

// Get a single order
router.get('/:id', async (req, res) => {
  try {
    console.log(`Fetching order with ID: ${req.params.id}`);
    const order = await Order.findById(req.params.id)
      .populate('customer', 'name email phone');
    if (!order) {
      console.log('Order not found');
      return res.status(404).json({ error: 'Order not found' });
    }
    console.log('Order found:', order.orderNumber);
    res.json(order);
  } catch (error) {
    console.error('Error fetching order:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(500).json({ 
      error: 'Error fetching order',
      details: error.message
    });
  }
});

// Create a new order
router.post('/', async (req, res) => {
  try {
    console.log('Creating new order with data:', req.body);
    const { customer, items, shippingAddress, paymentMethod, notes } = req.body;

    // Validate required fields
    if (!customer) {
      return res.status(400).json({ error: 'Customer ID is required' });
    }
    if (!items || !Array.isArray(items) || items.length === 0) {
      return res.status(400).json({ error: 'At least one item is required' });
    }
    if (!shippingAddress) {
      return res.status(400).json({ error: 'Shipping address is required' });
    }
    if (!paymentMethod) {
      return res.status(400).json({ error: 'Payment method is required' });
    }

    // Validate items
    for (const item of items) {
      if (!item.name || !item.quantity || !item.price) {
        return res.status(400).json({ 
          error: 'Each item must have name, quantity, and price'
        });
      }
      if (item.quantity <= 0) {
        return res.status(400).json({ 
          error: 'Item quantity must be greater than 0'
        });
      }
      if (item.price <= 0) {
        return res.status(400).json({ 
          error: 'Item price must be greater than 0'
        });
      }
    }

    // Validate customer exists
    const customerExists = await Customer.findById(customer);
    if (!customerExists) {
      console.log('Customer not found:', customer);
      return res.status(400).json({ error: 'Customer not found' });
    }

    // Calculate total amount
    const totalAmount = items.reduce((total, item) => {
      return total + (item.quantity * item.price);
    }, 0);

    // Generate order number (ORD-YYYYMMDD-XXXX)
    const date = new Date();
    const dateStr = date.getFullYear().toString() +
      (date.getMonth() + 1).toString().padStart(2, '0') +
      date.getDate().toString().padStart(2, '0');
    
    // Get count of orders for today
    const todayOrders = await Order.countDocuments({
      createdAt: {
        $gte: new Date(date.getFullYear(), date.getMonth(), date.getDate()),
        $lt: new Date(date.getFullYear(), date.getMonth(), date.getDate() + 1)
      }
    });
    
    const orderNumber = `ORD-${dateStr}-${(todayOrders + 1).toString().padStart(4, '0')}`;

    const order = new Order({
      customer,
      items,
      totalAmount,
      shippingAddress,
      paymentMethod,
      notes,
      orderNumber,
      status: 'pending',
      paymentStatus: 'pending'
    });

    console.log('Saving new order...');
    const savedOrder = await order.save();
    console.log('Order saved successfully:', savedOrder.orderNumber);

    // Update customer's total purchases and spend
    await Customer.findByIdAndUpdate(customer, {
      $inc: {
        totalPurchases: 1,
        totalSpend: totalAmount
      },
      lastPurchase: new Date()
    });
    console.log('Customer stats updated');

    res.status(201).json(savedOrder);
  } catch (error) {
    console.error('Error creating order:', error);
    console.error('Error details:', {
      message: error.message,
      stack: error.stack,
      name: error.name
    });
    res.status(400).json({ 
      error: 'Error creating order',
      details: error.message
    });
  }
});

// Update order status
router.patch('/:id/status', async (req, res) => {
  try {
    const { status } = req.body;
    if (!status) {
      return res.status(400).json({ error: 'Status is required' });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { status },
      { new: true, runValidators: true }
    );
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error updating order status:', error);
    res.status(400).json({ error: 'Error updating order status' });
  }
});

// Update payment status
router.patch('/:id/payment', async (req, res) => {
  try {
    const { paymentStatus } = req.body;
    if (!paymentStatus) {
      return res.status(400).json({ error: 'Payment status is required' });
    }
    const order = await Order.findByIdAndUpdate(
      req.params.id,
      { paymentStatus },
      { new: true, runValidators: true }
    );
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json(order);
  } catch (error) {
    console.error('Error updating payment status:', error);
    res.status(400).json({ error: 'Error updating payment status' });
  }
});

// Delete an order
router.delete('/:id', async (req, res) => {
  try {
    const order = await Order.findByIdAndDelete(req.params.id);
    if (!order) {
      return res.status(404).json({ error: 'Order not found' });
    }
    res.json({ message: 'Order deleted successfully' });
  } catch (error) {
    console.error('Error deleting order:', error);
    res.status(500).json({ error: 'Error deleting order' });
  }
});

module.exports = router; 