import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip } from 'recharts';
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function TradingBot() {
  const [settings, setSettings] = useState({
    is_active: 0,
    max_investment_per_trade: 5000,
    profit_target_percentage: 5,
    stop_loss_percentage: 3,
    max_trades_per_day: 5,
    max_open_positions: 3
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [walletBalance, setWalletBalance] = useState(0);
  const [transactions, setTransactions] = useState([]);
  const [botPerformance, setBotPerformance] = useState({
    totalTrades: 0,
    profitableTrades: 0,
    lossMakingTrades: 0,
    totalProfit: 0,
    totalLoss: 0,
    netProfitLoss: 0,
    winRate: 0,
    totalInvestment: 0,
    profitPerShare: 0
  });

  // Fetch trading bot settings
  const fetchSettings = () => {
    setLoading(true);
    setError(null);
    
    axios.get('http://localhost:5000/api/trading-bot')
      .then(response => {
        setSettings(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching trading bot settings:', error);
        setError('Failed to load trading bot settings');
        setLoading(false);
      });
  };

  // Fetch wallet balance
  const fetchWalletBalance = () => {
    axios.get('http://localhost:5000/api/wallet')
      .then(response => {
        setWalletBalance(response.data.balance);
      })
      .catch(error => {
        console.error('Error fetching wallet balance:', error);
      });
  };

  // Fetch transactions for bot performance
  const fetchTransactions = () => {
    axios.get('http://localhost:5000/api/transactions')
      .then(response => {
        setTransactions(response.data);
        calculateBotPerformance(response.data);
      })
      .catch(error => {
        console.error('Error fetching transactions:', error);
      });
  };
  
  // Calculate bot performance metrics
  const calculateBotPerformance = (transactions) => {
    // Filter bot transactions
    const botTransactions = transactions.filter(t => 
      t.description && t.description.includes('[BOT]')
    );
    
    // Group by transaction_id to pair buys with sells
    const tradeMap = {};
    botTransactions.forEach(t => {
      if (t.type === 'buy') {
        tradeMap[t.symbol] = tradeMap[t.symbol] || [];
        tradeMap[t.symbol].push({
          buy: t,
          sell: null
        });
      } else if (t.type === 'sell') {
        // Find the oldest unpaired buy for this symbol
        const trades = tradeMap[t.symbol] || [];
        const unpairedBuyIndex = trades.findIndex(trade => trade.sell === null);
        
        if (unpairedBuyIndex >= 0) {
          trades[unpairedBuyIndex].sell = t;
        }
      }
    });
    
    // Calculate performance metrics
    let totalTrades = 0;
    let profitableTrades = 0;
    let lossMakingTrades = 0;
    let totalProfit = 0;
    let totalLoss = 0;
    let totalInvestment = 0;
    let totalShares = 0;
    
    Object.values(tradeMap).forEach(trades => {
      trades.forEach(trade => {
        if (trade.buy && trade.sell) {
          totalTrades++;
          
          const buyAmount = trade.buy.amount;
          const sellAmount = trade.sell.amount;
          const pnl = sellAmount - buyAmount;
          const shares = trade.buy.quantity || 0;
          
          totalInvestment += buyAmount;
          totalShares += shares;
          
          if (pnl > 0) {
            profitableTrades++;
            totalProfit += pnl;
          } else {
            lossMakingTrades++;
            totalLoss += Math.abs(pnl);
          }
        }
      });
    });
    
    const netProfitLoss = totalProfit - totalLoss;
    const winRate = totalTrades > 0 ? (profitableTrades / totalTrades) * 100 : 0;
    const profitPerShare = totalShares > 0 ? netProfitLoss / totalShares : 0;
    
    setBotPerformance({
      totalTrades,
      profitableTrades,
      lossMakingTrades,
      totalProfit,
      totalLoss,
      netProfitLoss,
      winRate,
      totalInvestment,
      profitPerShare
    });
  };

  // Listen for socket events
  useEffect(() => {
    // Listen for transaction events
    socket.on('transaction_executed', (data) => {
      console.log('Transaction executed:', data);
      fetchWalletBalance();
    });
    
    // Listen for trade events
    socket.on('trade_executed', (data) => {
      console.log('Trade executed:', data);
      fetchWalletBalance();
      fetchTransactions();
    });
    
    return () => {
      socket.off('transaction_executed');
      socket.off('trade_executed');
    };
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchSettings();
    fetchWalletBalance();
    fetchTransactions();
  }, []);

  // Handle form input changes
  const handleInputChange = (e) => {
    const { name, value, type, checked } = e.target;
    
    if (type === 'checkbox') {
      setSettings(prev => ({
        ...prev,
        [name]: checked ? 1 : 0
      }));
    } else {
      setSettings(prev => ({
        ...prev,
        [name]: value
      }));
    }
  };

  // Handle form submission
  const handleSubmit = (e) => {
    e.preventDefault();
    setSaving(true);
    
    axios.put('http://localhost:5000/api/trading-bot', settings)
      .then(response => {
        setSettings(response.data.settings);
        setSaving(false);
        alert('Trading bot settings updated successfully');
      })
      .catch(error => {
        console.error('Error updating trading bot settings:', error);
        alert('Failed to update trading bot settings: ' + (error.response?.data?.error || error.message));
        setSaving(false);
      });
  };
  
  // Reset bot performance metrics
  const resetBotPerformance = () => {
    if (window.confirm('Are you sure you want to reset all bot performance metrics? This will delete all bot transaction history.')) {
      setSaving(true);
      
      axios.put('http://localhost:5000/api/trading-bot', { reset_performance: true })
        .then(response => {
          setSaving(false);
          alert('Bot performance metrics reset successfully');
          fetchTransactions();
        })
        .catch(error => {
          console.error('Error resetting bot performance:', error);
          alert('Failed to reset bot performance: ' + (error.response?.data?.error || error.message));
          setSaving(false);
        });
    }
  };

  return (
    <div className="border rounded p-4 bg-white shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">AI Trading Bot</h2>
        <div className="flex items-center">
          <span className={`inline-block w-3 h-3 rounded-full mr-2 ${settings.is_active ? 'bg-green-500' : 'bg-red-500'}`}></span>
          <span>{settings.is_active ? 'Active' : 'Inactive'}</span>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center p-4">Loading trading bot settings...</div>
      ) : error ? (
        <div className="text-center text-red-500 p-4">
          {error}
          <button 
            onClick={fetchSettings} 
            className="ml-2 bg-blue-500 text-white px-2 py-1 rounded text-sm"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-gray-50 rounded">
            <div className="text-lg text-gray-600">Available for Trading</div>
            <div className="text-3xl font-bold">₹{walletBalance.toFixed(2)}</div>
          </div>
          
          <form onSubmit={handleSubmit}>
            <div className="mb-4">
              <label className="flex items-center cursor-pointer">
                <input
                  type="checkbox"
                  name="is_active"
                  checked={settings.is_active === 1}
                  onChange={handleInputChange}
                  className="form-checkbox h-5 w-5 text-blue-600"
                />
                <span className="ml-2 text-gray-700">Enable AI Trading Bot</span>
              </label>
              <p className="text-sm text-gray-500 mt-1">
                When enabled, the bot will automatically trade based on signals and your settings
              </p>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Investment Per Trade (₹)
                </label>
                <input
                  type="number"
                  name="max_investment_per_trade"
                  value={settings.max_investment_per_trade}
                  onChange={handleInputChange}
                  min="100"
                  step="100"
                  className="border p-2 w-full rounded"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum amount to invest in a single trade
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Profit Target (%)
                </label>
                <input
                  type="number"
                  name="profit_target_percentage"
                  value={settings.profit_target_percentage}
                  onChange={handleInputChange}
                  min="0.5"
                  step="0.5"
                  className="border p-2 w-full rounded"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bot will sell when this profit percentage is reached
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Stop Loss (%)
                </label>
                <input
                  type="number"
                  name="stop_loss_percentage"
                  value={settings.stop_loss_percentage}
                  onChange={handleInputChange}
                  min="0.5"
                  step="0.5"
                  className="border p-2 w-full rounded"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Bot will sell to limit losses when price drops by this percentage
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Trades Per Day
                </label>
                <input
                  type="number"
                  name="max_trades_per_day"
                  value={settings.max_trades_per_day}
                  onChange={handleInputChange}
                  min="1"
                  max="10000"
                  className="border p-2 w-full rounded"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Limit the number of trades the bot can make per day
                </p>
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  Max Open Positions
                </label>
                <input
                  type="number"
                  name="max_open_positions"
                  value={settings.max_open_positions}
                  onChange={handleInputChange}
                  min="1"
                  max="10"
                  className="border p-2 w-full rounded"
                  required
                />
                <p className="text-xs text-gray-500 mt-1">
                  Maximum number of different stocks the bot can hold at once
                </p>
              </div>
            </div>
            
            <div className="mt-6">
              <button
                type="submit"
                className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded w-full"
                disabled={saving}
              >
                {saving ? 'Saving...' : 'Save Settings'}
              </button>
            </div>
          </form>
          
          {/* Bot Performance Metrics */}
          <div className="mt-6 mb-4">
            <div className="flex justify-between items-center mb-3">
              <h3 className="font-bold text-lg">Bot Performance Metrics</h3>
              <button
                onClick={resetBotPerformance}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
                disabled={saving}
              >
                Reset Performance
              </button>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded shadow border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Total Trades</div>
                    <div className="text-2xl font-bold">{botPerformance.totalTrades}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Win Rate</div>
                    <div className="text-2xl font-bold">{botPerformance.winRate.toFixed(1)}%</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Profitable</div>
                    <div className="text-2xl font-bold text-green-600">{botPerformance.profitableTrades}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Loss-making</div>
                    <div className="text-2xl font-bold text-red-600">{botPerformance.lossMakingTrades}</div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white p-4 rounded shadow border">
                <div className="grid grid-cols-2 gap-4">
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Total Investment</div>
                    <div className="text-2xl font-bold">₹{botPerformance.totalInvestment.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Profit Per Share</div>
                    <div className={`text-2xl font-bold ${botPerformance.profitPerShare >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {botPerformance.profitPerShare >= 0 ? '+' : ''}₹{botPerformance.profitPerShare.toFixed(2)}
                    </div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Total Profit</div>
                    <div className="text-2xl font-bold text-green-600">₹{botPerformance.totalProfit.toFixed(2)}</div>
                  </div>
                  <div className="text-center">
                    <div className="text-gray-500 text-sm">Total Loss</div>
                    <div className="text-2xl font-bold text-red-600">₹{botPerformance.totalLoss.toFixed(2)}</div>
                  </div>
                  <div className="text-center col-span-2">
                    <div className="text-gray-500 text-sm">Net Profit/Loss</div>
                    <div className={`text-2xl font-bold ${botPerformance.netProfitLoss >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                      {botPerformance.netProfitLoss >= 0 ? '+' : ''}₹{botPerformance.netProfitLoss.toFixed(2)}
                    </div>
                  </div>
                </div>
              </div>
            </div>
            
            {botPerformance.totalTrades > 0 && (
              <div className="mt-4 bg-white p-4 rounded shadow border">
                <h4 className="font-semibold mb-2 text-center">Trade Outcome Distribution</h4>
                <div className="h-64">
                  <ResponsiveContainer width="100%" height="100%">
                    <PieChart>
                      <Pie
                        data={[
                          { name: 'Profitable Trades', value: botPerformance.profitableTrades },
                          { name: 'Loss-making Trades', value: botPerformance.lossMakingTrades }
                        ]}
                        cx="50%"
                        cy="50%"
                        outerRadius={80}
                        fill="#8884d8"
                        dataKey="value"
                        label={({ name, percent }) => `${name}: ${(percent * 100).toFixed(0)}%`}
                      >
                        <Cell fill="#4ade80" />
                        <Cell fill="#f87171" />
                      </Pie>
                      <Tooltip />
                    </PieChart>
                  </ResponsiveContainer>
                </div>
              </div>
            )}
          </div>
          
          <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded text-sm">
            <h3 className="font-bold text-yellow-800 mb-2">How the AI Trading Bot Works</h3>
            <ul className="list-disc pl-5 text-yellow-800 space-y-1">
              <li>The bot analyzes market data and technical indicators to generate buy/sell signals</li>
              <li>When a buy signal is detected, the bot will invest up to your maximum investment amount</li>
              <li>The bot will automatically sell when either:
                <ul className="list-circle pl-5 mt-1">
                  <li>Your profit target is reached</li>
                  <li>The stop loss threshold is triggered</li>
                  <li>A sell signal is generated by the AI model</li>
                </ul>
              </li>
              <li>All bot transactions are marked with [BOT] in the transaction history</li>
              <li>The bot will never exceed your maximum open positions or trades per day limits</li>
            </ul>
          </div>
        </>
      )}
    </div>
  );
}

export default TradingBot;