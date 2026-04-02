// src/controllers/tradeController.js
// =============================================
// TRADE CONTROLLER - FULL CRUD OPERATIONS
// =============================================

const Trade = require('../models/trade');
const asyncHandler = require('../utils/asyncHandler');
const AppError = require('../utils/AppError');
const { z } = require('zod');

// ====================== ZOD VALIDATION SCHEMAS ======================
const createTradeSchema = z.object({
  symbol: z.string().min(3).max(20).toUpperCase(),
  tradeType: z.enum(['BUY', 'SELL']),
  quantity: z.number().positive(),
  price: z.number().positive(),
  fee: z.number().nonnegative().default(0),
  tradeDate: z.string().datetime().optional(),
  notes: z.string().max(500).optional()
});

const updateTradeSchema = createTradeSchema.partial(); // all fields optional

// ====================== CREATE TRADE ======================
const createTrade = asyncHandler(async (req, res, next) => {
  const result = createTradeSchema.safeParse(req.body);
  
  // 🔥 BUG FIX: Safely map over 'issues' instead of 'errors' to prevent crashes
  if (!result.success) {
    const errorMessages = result.error.issues?.map(e => e.message).join(', ') || 'Invalid trade data provided';
    throw new AppError(errorMessages, 400);
  }

  const { symbol, tradeType, quantity, price, fee, tradeDate, notes } = result.data;
  let realizedPnl = 0;

  // --- 🔥 IMPROVED P&L LOGIC ---
  if (tradeType === 'SELL') {
    // 1. Find all previous BUY trades for this specific coin by this user
    const buyTrades = await Trade.find({ 
      user: req.user._id, 
      symbol: symbol, 
      tradeType: 'BUY' 
    });

    if (buyTrades.length > 0) {
      // 2. Calculate the average buy price
      let totalCost = 0;
      let totalCoins = 0;
      
      buyTrades.forEach(trade => {
        totalCost += (trade.price * trade.quantity);
        totalCoins += trade.quantity;
      });

      const avgBuyPrice = totalCost / totalCoins;

      // 3. Calculate actual PnL: (Sell Price - Avg Buy Price) * Quantity - Fees
      realizedPnl = ((price - avgBuyPrice) * quantity) - fee;
      
      // Round to 2 decimal places
      realizedPnl = Math.round(realizedPnl * 100) / 100;
    } else {
      // If they sell without logging a buy first, just deduct the fee
      realizedPnl = -fee; 
    }
  }

  const trade = await Trade.create({
    user: req.user._id,
    symbol,
    tradeType,
    quantity,
    price,
    fee,
    tradeDate: tradeDate || Date.now(),
    notes,
    realizedPnl
  });

  res.status(201).json({
    success: true,
    message: 'Trade logged successfully',
    data: trade
  });
});

// ====================== GET ALL TRADES (User sees own, Admin sees all) ======================
const getTrades = asyncHandler(async (req, res, next) => {
  let trades;

  if (req.user.role === 'ADMIN') {
    trades = await Trade.find().populate('user', 'name email');
  } else {
    trades = await Trade.find({ user: req.user._id }).populate('user', 'name email');
  }

  res.status(200).json({
    success: true,
    results: trades.length,
    data: trades
  });
});

// ====================== GET SINGLE TRADE ======================
const getTrade = asyncHandler(async (req, res, next) => {
  const trade = await Trade.findById(req.params.id).populate('user', 'name email');

  if (!trade) {
    throw new AppError('Trade not found', 404);
  }

  // Normal user can only see their own trade
  if (req.user.role !== 'ADMIN' && trade.user._id.toString() !== req.user._id.toString()) {
    throw new AppError('You can only view your own trades', 403);
  }

  res.status(200).json({
    success: true,
    data: trade
  });
});

// ====================== UPDATE TRADE ======================
const updateTrade = asyncHandler(async (req, res, next) => {
  const result = updateTradeSchema.safeParse(req.body);
  
  // 🔥 BUG FIX: Safely map over 'issues' instead of 'errors'
  if (!result.success) {
    const errorMessages = result.error.issues?.map(e => e.message).join(', ') || 'Invalid trade data provided';
    throw new AppError(errorMessages, 400);
  }

  const trade = await Trade.findById(req.params.id);

  if (!trade) throw new AppError('Trade not found', 404);

  // Ownership check
  if (req.user.role !== 'ADMIN' && trade.user.toString() !== req.user._id.toString()) {
    throw new AppError('You can only update your own trades', 403);
  }

  // OPTIMIZED: Update fields directly on the fetched document and save it.
  // This avoids a second database lookup via findByIdAndUpdate.
  Object.assign(trade, result.data);
  const updatedTrade = await trade.save();

  res.status(200).json({
    success: true,
    message: 'Trade updated successfully',
    data: updatedTrade
  });
});

// ====================== DELETE TRADE ======================
const deleteTrade = asyncHandler(async (req, res, next) => {
  const trade = await Trade.findById(req.params.id);

  if (!trade) throw new AppError('Trade not found', 404);

  if (req.user.role !== 'ADMIN' && trade.user.toString() !== req.user._id.toString()) {
    throw new AppError('You can only delete your own trades', 403);
  }

  // OPTIMIZED: Delete the document directly using the fetched instance.
  // This avoids a second database lookup via findByIdAndDelete.
  await trade.deleteOne();

  res.status(200).json({
    success: true,
    message: 'Trade deleted successfully'
  });
});

// ====================== GET DASHBOARD STATS (NOW PLATFORM-WIDE FOR ADMIN) ======================
const getDashboardStats = asyncHandler(async (req, res, next) => {
  const matchStage = req.user.role === 'ADMIN' 
    ? {} 
    : { user: req.user._id };

  const stats = await Trade.aggregate([
    { $match: matchStage },
    {
      $group: {
        _id: null,
        totalTrades: { $sum: 1 },
        totalRealizedPnl: { $sum: '$realizedPnl' },
        totalFees: { $sum: '$fee' },
        winningTrades: { $sum: { $cond: [{ $gt: ['$realizedPnl', 0] }, 1, 0] } },
        losingTrades: { $sum: { $cond: [{ $lt: ['$realizedPnl', 0] }, 1, 0] } }
      }
    }
  ]);

  let summary = {
    totalTrades: 0, totalRealizedPnl: 0, totalFees: 0,
    winningTrades: 0, losingTrades: 0, winRate: 0
  };

  if (stats.length > 0) {
    summary = stats[0];
    delete summary._id;
    const closed = summary.winningTrades + summary.losingTrades;
    summary.winRate = closed > 0 
      ? Number(((summary.winningTrades / closed) * 100).toFixed(2)) 
      : 0;
  }

  res.status(200).json({ success: true, data: summary });
});

// ====================== EXPORT CSV (ADMIN = ALL TRADES) ======================
const exportTradesCSV = asyncHandler(async (req, res, next) => {
  const query = req.user.role === 'ADMIN' ? {} : { user: req.user._id };

  const trades = await Trade.find(query)
    .sort({ tradeDate: -1 })
    .populate('user', 'name email');

  if (!trades.length) throw new AppError('No trades found to export', 404);

  const headers = ['Trade ID', 'Symbol', 'Type', 'Quantity', 'Price', 'Fee', 'Realized PnL', 'Date', 'Notes'];

  const csvRows = trades.map(trade => [
    trade._id,
    trade.symbol,
    trade.tradeType,
    trade.quantity,
    trade.price,
    trade.fee,
    trade.realizedPnl,
    new Date(trade.tradeDate).toISOString().split('T')[0],
    `"${trade.notes ? trade.notes.replace(/"/g, '""') : ''}"`
  ].join(','));

  const csvData = [headers.join(','), ...csvRows].join('\n');
  const filename = req.user.role === 'ADMIN' ? 'all_platform_trades.csv' : 'my_trades.csv';

  res.setHeader('Content-Type', 'text/csv');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.status(200).send(csvData);
});

module.exports = {
  createTrade,
  getTrades,
  getTrade,
  updateTrade,
  deleteTrade,
  getDashboardStats,
  exportTradesCSV
};