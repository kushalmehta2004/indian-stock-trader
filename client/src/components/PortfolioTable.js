import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { FaInfoCircle } from 'react-icons/fa';

const socket = io('http://localhost:5000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function PortfolioTable({ selectedSymbol, stocks = [], showSummary = false, summaryOnly = false }) {
  const [portfolio, setPortfolio] = useState([]);
  const [currentPrices, setCurrentPrices] = useState({});
  const [previousDayPrices, setPreviousDayPrices] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchPortfolio = () => {
    setLoading(true);
    setError(null);
    axios.get('http://localhost:5000/api/portfolio')
      .then(response => {
        setPortfolio(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching portfolio:', error);
        setError('Failed to load portfolio data');
        setLoading(false);
      });
  };
  
  const clearPortfolio = () => {
    if (window.confirm('Are you sure you want to clear your entire portfolio? This action cannot be undone.')) {
      setLoading(true);
      axios.delete('http://localhost:5000/api/portfolio')
        .then(response => {
          console.log('Portfolio cleared:', response.data);
          setPortfolio([]);
          setLoading(false);
          alert('Portfolio cleared successfully');
        })
        .catch(error => {
          console.error('Error clearing portfolio:', error);
          setError('Failed to clear portfolio');
          setLoading(false);
        });
    }
  };

  // Initialize currentPrices from stocks data
  useEffect(() => {
    const initialPrices = {};
    stocks.forEach(stock => {
      if (stock.price) {
        initialPrices[stock.symbol] = stock.price;
      }
    });
    setCurrentPrices(prev => ({ ...prev, ...initialPrices }));
  }, [stocks]);

  useEffect(() => {
    fetchPortfolio();

    socket.on('stock_update', (data) => {
      setCurrentPrices(prev => ({ ...prev, [data.symbol]: data.current_price }));
      if (data.previous_day_price) {
        setPreviousDayPrices(prev => ({ ...prev, [data.symbol]: data.previous_day_price }));
      }
    });
    
    // Listen for trade events to update portfolio
    socket.on('trade_executed', (data) => {
      console.log('Trade executed, updating portfolio:', data);
      fetchPortfolio();
    });

    // Refresh portfolio data every 30 seconds
    const intervalId = setInterval(fetchPortfolio, 30000);

    return () => {
      socket.off('stock_update');
      socket.off('trade_executed');
      clearInterval(intervalId);
    };
  }, []);

  // Calculate total portfolio value and P&L
  const calculateTotals = () => {
    let totalInvestment = 0;
    let totalCurrentValue = 0;

    filteredPortfolio.forEach(entry => {
      const investment = entry.totalInvestment;
      const currentValue = (currentPrices[entry.symbol] || entry.buy_price) * entry.quantity;
      
      totalInvestment += investment;
      totalCurrentValue += currentValue;
    });

    const totalPnL = totalCurrentValue - totalInvestment;
    const pnlPercentage = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;

    return {
      totalInvestment,
      totalCurrentValue,
      totalPnL,
      pnlPercentage
    };
  };

  if (loading) {
    return <div className="p-4 text-center">Loading portfolio data...</div>;
  }

  if (error) {
    return (
      <div className="p-4 text-center text-red-500">
        {error}
        <button 
          onClick={fetchPortfolio} 
          className="ml-4 bg-blue-500 text-white px-3 py-1 rounded"
        >
          Retry
        </button>
      </div>
    );
  }

  if (portfolio.length === 0) {
    return <div className="p-4 text-center">No portfolio entries yet. Add some stocks to your portfolio!</div>;
  }

  // Aggregate portfolio entries by symbol
  const aggregatePortfolio = (portfolioData) => {
    const aggregated = {};
    
    portfolioData.forEach(entry => {
      const { symbol, quantity, buy_price } = entry;
      
      if (!aggregated[symbol]) {
        aggregated[symbol] = {
          symbol,
          quantity: 0,
          totalInvestment: 0,
          entries: []
        };
      }
      
      aggregated[symbol].quantity += quantity;
      aggregated[symbol].totalInvestment += quantity * buy_price;
      aggregated[symbol].entries.push(entry);
    });
    
    // Calculate average buy price
    Object.values(aggregated).forEach(item => {
      item.buy_price = item.totalInvestment / item.quantity;
    });
    
    return Object.values(aggregated);
  };
  
  // Filter and aggregate portfolio
  const filteredPortfolio = selectedSymbol 
    ? aggregatePortfolio(portfolio.filter(entry => entry.symbol === selectedSymbol))
    : aggregatePortfolio(portfolio);
    
  const totals = calculateTotals();

  // Calculate overall portfolio summary (all stocks, not just filtered)
  const calculateOverallSummary = () => {
    // Aggregate all portfolio entries by symbol
    const allAggregated = aggregatePortfolio(portfolio);
    
    let totalInvestment = 0;
    let totalCurrentValue = 0;
    let totalPreviousDayValue = 0;
    let totalStocks = 0;
    
    allAggregated.forEach(entry => {
      const investment = entry.totalInvestment;
      const currentPrice = currentPrices[entry.symbol] || entry.buy_price;
      const previousDayPrice = previousDayPrices[entry.symbol] || currentPrice;
      
      const currentValue = currentPrice * entry.quantity;
      const previousDayValue = previousDayPrice * entry.quantity;
      
      totalInvestment += investment;
      totalCurrentValue += currentValue;
      totalPreviousDayValue += previousDayValue;
      totalStocks += entry.quantity;
    });
    
    const totalPnL = totalCurrentValue - totalInvestment;
    const pnlPercentage = totalInvestment > 0 ? (totalPnL / totalInvestment) * 100 : 0;
    
    // Calculate daily P&L
    const dailyPnL = totalCurrentValue - totalPreviousDayValue;
    const dailyPnLPercentage = totalPreviousDayValue > 0 ? (dailyPnL / totalPreviousDayValue) * 100 : 0;
    
    return {
      totalInvestment,
      totalCurrentValue,
      totalPnL,
      pnlPercentage,
      dailyPnL,
      dailyPnLPercentage,
      totalStocks,
      stockCount: allAggregated.length
    };
  };
  
  const overallSummary = calculateOverallSummary();

  // If we're in summaryOnly mode and there's no portfolio data yet
  if (summaryOnly && (loading || portfolio.length === 0)) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              Total Investment
              <FaInfoCircle 
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Total amount invested in all stocks"
                size={14}
              />
            </div>
            <div className="text-2xl font-bold dark:text-white">₹0.00</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              Current Value
              <FaInfoCircle 
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Current market value of all your holdings"
                size={14}
              />
            </div>
            <div className="text-2xl font-bold dark:text-white">₹0.00</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              Overall P&L
              <FaInfoCircle 
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Total profit or loss since purchase"
                size={14}
              />
            </div>
            <div className="text-2xl font-bold dark:text-white">₹0.00 (0.00%)</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              Today's P&L
              <FaInfoCircle 
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Profit or loss for the current trading day"
                size={14}
              />
            </div>
            <div className="text-2xl font-bold dark:text-white">₹0.00 (0.00%)</div>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {loading ? "Loading portfolio data..." : "No stocks in portfolio yet"}
        </div>
      </div>
    );
  }

  // If we're in summaryOnly mode and have portfolio data
  if (summaryOnly) {
    return (
      <div className="p-4 border rounded bg-gray-50">
        <div className="flex justify-between items-center mb-3">
          <div className="text-lg font-bold">Portfolio Overview</div>
          {portfolio.length > 0 && (
            <button 
              onClick={clearPortfolio}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            >
              Clear Portfolio
            </button>
          )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              Total Investment
              <FaInfoCircle 
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Total amount invested in all stocks"
                size={14}
              />
            </div>
            <div className="text-2xl font-bold dark:text-white">₹{overallSummary.totalInvestment.toFixed(2)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              Current Value
              <FaInfoCircle 
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Current market value of all your holdings"
                size={14}
              />
            </div>
            <div className="text-2xl font-bold dark:text-white">₹{overallSummary.totalCurrentValue.toFixed(2)}</div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              Overall P&L
              <FaInfoCircle 
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Total profit or loss since purchase"
                size={14}
              />
            </div>
            <div className={`text-2xl font-bold ${overallSummary.totalPnL >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              {overallSummary.totalPnL >= 0 ? '+' : ''}₹{overallSummary.totalPnL.toFixed(2)} 
              <span className="text-lg ml-1">
                ({overallSummary.pnlPercentage >= 0 ? '+' : ''}{overallSummary.pnlPercentage.toFixed(2)}%)
              </span>
            </div>
          </div>
          <div className="bg-white dark:bg-gray-800 p-3 rounded shadow">
            <div className="text-gray-500 dark:text-gray-400 flex items-center">
              Today's P&L
              <FaInfoCircle 
                className="ml-1 text-gray-400 dark:text-gray-500 cursor-help" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Profit or loss for the current trading day"
                size={14}
              />
            </div>
            <div className={`text-2xl font-bold ${overallSummary.dailyPnL >= 0 ? 'text-green-600 dark:text-green-500' : 'text-red-600 dark:text-red-500'}`}>
              {overallSummary.dailyPnL >= 0 ? '+' : ''}₹{overallSummary.dailyPnL.toFixed(2)} 
              <span className="text-lg ml-1">
                ({overallSummary.dailyPnLPercentage >= 0 ? '+' : ''}{overallSummary.dailyPnLPercentage.toFixed(2)}%)
              </span>
            </div>
          </div>
        </div>
        <div className="mt-2 text-sm text-gray-500">
          {overallSummary.stockCount} different stocks, {overallSummary.totalStocks} shares in total
        </div>
      </div>
    );
  }

  // Handle selling stocks
  const handleSellStock = (symbol, currentPrice) => {
    const entry = filteredPortfolio.find(e => e.symbol === symbol);
    if (!entry) return;
    
    const quantity = prompt(`Enter quantity to sell for ${symbol} (max: ${entry.quantity}):`, entry.quantity);
    if (!quantity || isNaN(quantity) || parseInt(quantity) <= 0 || parseInt(quantity) > entry.quantity) {
      alert('Please enter a valid quantity');
      return;
    }
    
    axios.post('http://localhost:5000/api/trade', {
      symbol,
      action: 'sell',
      quantity: parseInt(quantity),
      current_price: currentPrice
    })
      .then(response => {
        alert(response.data.message);
        fetchPortfolio();
      })
      .catch(error => alert('Trade failed: ' + (error.response?.data?.error || error.message)));
  };

  return (
    <div>
      {showSummary && (
        <div className="mb-4 p-4 border rounded bg-gray-50">
          <div className="flex justify-between items-center mb-2">
            <h3 className="text-lg font-bold">Portfolio Summary</h3>
            {portfolio.length > 0 && (
              <button 
                onClick={clearPortfolio}
                className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
              >
                Clear Portfolio
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white p-3 rounded shadow">
              <div className="text-gray-500">Total Investment</div>
              <div className="text-2xl font-bold">₹{overallSummary.totalInvestment.toFixed(2)}</div>
            </div>
            <div className="bg-white p-3 rounded shadow">
              <div className="text-gray-500">Current Value</div>
              <div className="text-2xl font-bold">₹{overallSummary.totalCurrentValue.toFixed(2)}</div>
            </div>
            <div className="bg-white p-3 rounded shadow">
              <div className="text-gray-500">Overall P&L</div>
              <div className={`text-2xl font-bold ${overallSummary.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {overallSummary.totalPnL >= 0 ? '+' : ''}₹{overallSummary.totalPnL.toFixed(2)} 
                <span className="text-lg ml-1">
                  ({overallSummary.pnlPercentage >= 0 ? '+' : ''}{overallSummary.pnlPercentage.toFixed(2)}%)
                </span>
              </div>
            </div>
            <div className="bg-white p-3 rounded shadow">
              <div className="text-gray-500">Today's P&L</div>
              <div className={`text-2xl font-bold ${overallSummary.dailyPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {overallSummary.dailyPnL >= 0 ? '+' : ''}₹{overallSummary.dailyPnL.toFixed(2)} 
                <span className="text-lg ml-1">
                  ({overallSummary.dailyPnLPercentage >= 0 ? '+' : ''}{overallSummary.dailyPnLPercentage.toFixed(2)}%)
                </span>
              </div>
            </div>
          </div>
          <div className="mt-2 text-sm text-gray-500">
            {overallSummary.stockCount} different stocks, {overallSummary.totalStocks} shares in total
          </div>
        </div>
      )}
      
      <div className="border rounded overflow-hidden">
        <div className="flex justify-between items-center bg-gray-100 p-2">
          <h3 className="font-semibold">Portfolio Holdings</h3>
          {portfolio.length > 0 && !summaryOnly && (
            <button 
              onClick={clearPortfolio}
              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded text-sm"
            >
              Clear All Holdings
            </button>
          )}
        </div>
        <table className="w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="border p-2 text-left">Symbol</th>
              <th className="border p-2 text-right">Quantity</th>
              <th className="border p-2 text-right">Buy Price (₹)</th>
              <th className="border p-2 text-right">Current Price (₹)</th>
              <th className="border p-2 text-right">Investment (₹)</th>
              <th className="border p-2 text-right">Current Value (₹)</th>
              <th className="border p-2 text-right">P&L (₹)</th>
              <th className="border p-2 text-right">P&L (%)</th>
              <th className="border p-2 text-center">Actions</th>
            </tr>
          </thead>
        <tbody>
          {filteredPortfolio.map(entry => {
            const currentPrice = currentPrices[entry.symbol] || entry.buy_price;
            const investment = entry.totalInvestment;
            const currentValue = currentPrice * entry.quantity;
            const pnl = currentValue - investment;
            const pnlPercentage = (pnl / investment) * 100;
            
            return (
              <tr key={entry.symbol}>
                <td className="border p-2">{entry.symbol}</td>
                <td className="border p-2 text-right">{entry.quantity}</td>
                <td className="border p-2 text-right">₹{parseFloat(entry.buy_price).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{parseFloat(currentPrice).toFixed(2)}</td>
                <td className="border p-2 text-right">₹{investment.toFixed(2)}</td>
                <td className="border p-2 text-right">₹{currentValue.toFixed(2)}</td>
                <td className={`border p-2 text-right ${pnl >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnl >= 0 ? '+' : ''}₹{pnl.toFixed(2)}
                </td>
                <td className={`border p-2 text-right ${pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                  {pnlPercentage >= 0 ? '+' : ''}{pnlPercentage.toFixed(2)}%
                </td>
                <td className="border p-2 text-center">
                  <button
                    onClick={() => handleSellStock(entry.symbol, currentPrice)}
                    className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded text-sm"
                  >
                    Sell
                  </button>
                </td>
              </tr>
            );
          })}
        </tbody>
        {filteredPortfolio.length > 1 && (
          <tfoot className="bg-gray-100 font-bold">
            <tr>
              <td className="border p-2" colSpan="4">Total</td>
              <td className="border p-2 text-right">₹{totals.totalInvestment.toFixed(2)}</td>
              <td className="border p-2 text-right">₹{totals.totalCurrentValue.toFixed(2)}</td>
              <td className={`border p-2 text-right ${totals.totalPnL >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.totalPnL >= 0 ? '+' : ''}₹{totals.totalPnL.toFixed(2)}
              </td>
              <td className={`border p-2 text-right ${totals.pnlPercentage >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {totals.pnlPercentage >= 0 ? '+' : ''}{totals.pnlPercentage.toFixed(2)}%
              </td>
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  </div>
  );
}

export default PortfolioTable;
