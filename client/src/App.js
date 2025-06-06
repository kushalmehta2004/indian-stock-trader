import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import StockChart from './components/StockChart';
import PortfolioForm from './components/PortfolioForm';
import PortfolioTable from './components/PortfolioTable';
import Wallet from './components/Wallet';
import TradingBot from './components/TradingBot';
import TransactionHistory from './components/TransactionHistory';
import { FaSun, FaMoon, FaRobot, FaChartLine, FaWallet, FaHistory, FaBriefcase } from 'react-icons/fa';

const socket = io('http://localhost:5000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function App() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState('');
  const [loading, setLoading] = useState(true);
  const [walletBalance, setWalletBalance] = useState(0);
  const [darkMode, setDarkMode] = useState(false);
  const [activeTab, setActiveTab] = useState('dashboard');

  useEffect(() => {
    setLoading(true);
    axios.get('http://localhost:5000/api/stocks')
      .then(response => {
        console.log('Stocks data received:', response.data);
        setStocks(response.data.map(stock => ({
          ...stock,
          price: null,
          signal: 'Hold'
        })));
        if (response.data.length > 0 && !selectedStock) {
          setSelectedStock(response.data[0].symbol);
        }
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching stocks:', error);
        setLoading(false);
      });

    socket.on('stock_update', (data) => {
      console.log('Received stock update:', data);
      setStocks(prevStocks =>
        prevStocks.map(stock =>
          stock.symbol === data.symbol
            ? { ...stock, price: data.current_price, signal: data.signal }
            : stock
        )
      );
    });

    return () => socket.off('stock_update');
  }, []);

  const handleTrade = (symbol, action, currentPrice) => {
    const quantity = prompt(`Enter quantity to ${action}:`);
    if (quantity && !isNaN(quantity) && quantity > 0) {
      // Calculate total cost
      const totalCost = parseInt(quantity) * currentPrice;
      
      // Check if user has enough funds for buying
      if (action === 'buy' && totalCost > walletBalance) {
        alert(`Insufficient funds in wallet. Required: ₹${totalCost.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}`);
        return;
      }
      
      axios.post('http://localhost:5000/api/trade', {
        symbol,
        action,
        quantity: parseInt(quantity),
        current_price: currentPrice
      })
        .then(response => {
          alert(response.data.message);
          // Update wallet balance
          setWalletBalance(response.data.wallet_balance);
        })
        .catch(error => alert('Trade failed: ' + (error.response?.data?.error || error.message)));
    }
  };

  const handleStockChange = (e) => {
    setSelectedStock(e.target.value);
  };

  // Apply dark mode to the entire app
  useEffect(() => {
    if (darkMode) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [darkMode]);

  return (
    <div className={`min-h-screen ${darkMode ? 'bg-gray-900 text-white' : 'bg-gray-100 text-gray-900'}`}>
      {/* Sidebar */}
      <div className={`fixed left-0 top-0 h-full w-64 ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow-lg transition-all duration-300 z-10`}>
        <div className="p-4 border-b border-gray-200 dark:border-gray-700">
          <h1 className="text-2xl font-bold flex items-center">
            <FaChartLine className="mr-2" />
            Indian Stock Trader
          </h1>
          <p className={`text-sm mt-1 ${darkMode ? 'text-gray-400' : 'text-gray-600'}`}>
            AI-powered trading platform
          </p>
        </div>
        
        <nav className="p-4">
          <ul className="space-y-2">
            <li>
              <button 
                onClick={() => setActiveTab('dashboard')}
                className={`w-full text-left p-2 rounded flex items-center ${
                  activeTab === 'dashboard' 
                    ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800') 
                    : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')
                }`}
              >
                <FaChartLine className="mr-2" /> Dashboard
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('portfolio')}
                className={`w-full text-left p-2 rounded flex items-center ${
                  activeTab === 'portfolio' 
                    ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800') 
                    : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')
                }`}
              >
                <FaBriefcase className="mr-2" /> Portfolio
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('tradingbot')}
                className={`w-full text-left p-2 rounded flex items-center ${
                  activeTab === 'tradingbot' 
                    ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800') 
                    : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')
                }`}
              >
                <FaRobot className="mr-2" /> Trading Bot
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('transactions')}
                className={`w-full text-left p-2 rounded flex items-center ${
                  activeTab === 'transactions' 
                    ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800') 
                    : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')
                }`}
              >
                <FaHistory className="mr-2" /> Transactions
              </button>
            </li>
            <li>
              <button 
                onClick={() => setActiveTab('wallet')}
                className={`w-full text-left p-2 rounded flex items-center ${
                  activeTab === 'wallet' 
                    ? (darkMode ? 'bg-blue-600 text-white' : 'bg-blue-100 text-blue-800') 
                    : (darkMode ? 'text-gray-300 hover:bg-gray-700' : 'text-gray-700 hover:bg-gray-200')
                }`}
              >
                <FaWallet className="mr-2" /> Wallet
              </button>
            </li>
          </ul>
        </nav>
        
        <div className="absolute bottom-0 left-0 right-0 p-4 border-t border-gray-200 dark:border-gray-700">
          <button 
            onClick={() => setDarkMode(!darkMode)}
            className={`w-full p-2 rounded flex items-center justify-center ${
              darkMode ? 'bg-gray-700 text-yellow-400' : 'bg-gray-200 text-gray-700'
            }`}
          >
            {darkMode ? <FaSun className="mr-2" /> : <FaMoon className="mr-2" />}
            {darkMode ? 'Light Mode' : 'Dark Mode'}
          </button>
        </div>
      </div>
      
      {/* Main Content */}
      <div className="ml-64 p-6 transition-all duration-300">
        {/* Top Bar */}
        <div className={`flex justify-between items-center mb-6 pb-4 border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>
          <h2 className="text-2xl font-bold">
            {activeTab === 'dashboard' && 'Dashboard'}
            {activeTab === 'portfolio' && 'My Portfolio'}
            {activeTab === 'tradingbot' && 'AI Trading Bot'}
            {activeTab === 'transactions' && 'Transaction History'}
            {activeTab === 'wallet' && 'Wallet Management'}
          </h2>
          
          <div className="flex items-center">
            <div className={`mr-4 px-4 py-2 rounded-full ${darkMode ? 'bg-gray-800' : 'bg-white'} shadow`}>
              <span className={darkMode ? 'text-gray-400' : 'text-gray-600'}>Balance:</span> 
              <span className="font-bold ml-1">₹{walletBalance.toFixed(2)}</span>
            </div>
          </div>
        </div>
        
        {/* Dashboard Tab */}
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Portfolio Summary */}
            <div>
              <PortfolioTable selectedSymbol="" stocks={stocks} showSummary={true} summaryOnly={true} />
            </div>
            
            {/* Stock Selection and Trading Options */}
            <div className={`p-4 rounded-lg shadow ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <label htmlFor="stockSelect" className="block text-lg font-semibold mb-2">
                Select Stock to Trade:
              </label>
              <select
                id="stockSelect"
                value={selectedStock}
                onChange={handleStockChange}
                className={`border p-2 rounded w-full md:w-1/3 ${
                  darkMode ? 'bg-gray-700 border-gray-600 text-white' : 'bg-white border-gray-300'
                }`}
              >
                <option value="">-- Select a stock --</option>
                {stocks.map(stock => (
                  <option key={stock.symbol} value={stock.symbol}>
                    {stock.name} ({stock.symbol})
                  </option>
                ))}
              </select>
              
              {/* Trading Signal Indicator */}
              {selectedStock && (
                <div className={`mt-4 p-4 rounded ${darkMode ? 'bg-gray-700' : 'bg-gray-50'}`}>
                  <h2 className="text-xl font-bold mb-2">Trading Options</h2>
                  {loading ? (
                    <p>Loading signal data...</p>
                  ) : (
                    <div className="flex flex-wrap items-center">
                      <div className="text-xl mr-4">
                        {selectedStock && stocks.find(s => s.symbol === selectedStock)?.name} ({selectedStock}):
                      </div>
                      <div className="text-2xl font-bold">
                        {stocks.find(s => s.symbol === selectedStock)?.price 
                          ? `₹${stocks.find(s => s.symbol === selectedStock)?.price.toFixed(2)}` 
                          : 'Loading price...'}
                      </div>
                      <div className={`ml-6 text-xl font-bold px-4 py-2 rounded ${
                        stocks.find(s => s.symbol === selectedStock)?.signal === 'Buy'
                          ? 'bg-green-500 text-white'
                          : stocks.find(s => s.symbol === selectedStock)?.signal === 'Sell'
                            ? 'bg-red-500 text-white'
                            : 'bg-yellow-500 text-white'
                      }`}>
                        {stocks.find(s => s.symbol === selectedStock)?.signal || 'Hold'}
                      </div>
                      <div className="ml-auto mt-2 md:mt-0">
                        <button
                          onClick={() => {
                            const stock = stocks.find(s => s.symbol === selectedStock);
                            if (stock && stock.price) {
                              handleTrade(selectedStock, 'buy', stock.price);
                            }
                          }}
                          className="bg-green-500 hover:bg-green-600 text-white px-4 py-2 rounded mr-2"
                          disabled={!stocks.find(s => s.symbol === selectedStock)?.price}
                        >
                          Buy
                        </button>
                        <button
                          onClick={() => {
                            const stock = stocks.find(s => s.symbol === selectedStock);
                            if (stock && stock.price) {
                              handleTrade(selectedStock, 'sell', stock.price);
                            }
                          }}
                          className="bg-red-500 hover:bg-red-600 text-white px-4 py-2 rounded"
                          disabled={!stocks.find(s => s.symbol === selectedStock)?.price}
                        >
                          Sell
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
            
            {/* Stock Chart */}
            {selectedStock && (
              <div>
                <StockChart symbol={selectedStock} />
              </div>
            )}
            
            {/* Available Stocks List */}
            <div className={`rounded-lg shadow overflow-hidden ${darkMode ? 'bg-gray-800' : 'bg-white'}`}>
              <div className="p-4 border-b border-gray-200 dark:border-gray-700">
                <h2 className="text-xl font-semibold">Available Stocks</h2>
              </div>
              {loading ? (
                <div className="p-4 text-center">Loading stocks...</div>
              ) : stocks.length === 0 ? (
                <div className="p-4 text-center">No stocks available</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full">
                    <thead className={darkMode ? 'bg-gray-700' : 'bg-gray-50'}>
                      <tr>
                        <th className={`p-3 text-left ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Name</th>
                        <th className={`p-3 text-left ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Symbol</th>
                        <th className={`p-3 text-right ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Price (₹)</th>
                        <th className={`p-3 text-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Signal</th>
                        <th className={`p-3 text-center ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}>Actions</th>
                      </tr>
                    </thead>
                    <tbody>
                      {stocks.map(stock => (
                        <tr
                          key={stock.symbol}
                          className={`cursor-pointer ${
                            selectedStock === stock.symbol 
                              ? (darkMode ? 'bg-blue-900 bg-opacity-30' : 'bg-blue-100') 
                              : (darkMode ? 'hover:bg-gray-700' : 'hover:bg-gray-50')
                          } border-b ${darkMode ? 'border-gray-700' : 'border-gray-200'}`}
                          onClick={() => setSelectedStock(stock.symbol)}
                        >
                          <td className="p-3">{stock.name}</td>
                          <td className="p-3 font-medium">{stock.symbol}</td>
                          <td className="p-3 text-right">
                            {stock.price ? `₹${stock.price.toFixed(2)}` : 'Loading...'}
                          </td>
                          <td className="p-3 text-center">
                            <span className={`inline-block font-semibold px-2 py-1 rounded ${
                              stock.signal === 'Buy'
                                ? 'bg-green-500 text-white'
                                : stock.signal === 'Sell'
                                  ? 'bg-red-500 text-white'
                                  : 'bg-yellow-500 text-white'
                            }`}>
                              {stock.signal || 'Hold'}
                            </span>
                          </td>
                          <td className="p-3 text-center">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (stock.price) {
                                  handleTrade(stock.symbol, 'buy', stock.price);
                                }
                              }}
                              className="bg-green-500 hover:bg-green-600 text-white px-3 py-1 rounded mr-2"
                              disabled={!stock.price}
                            >
                              Buy
                            </button>
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                if (stock.price) {
                                  handleTrade(stock.symbol, 'sell', stock.price);
                                }
                              }}
                              className="bg-red-500 hover:bg-red-600 text-white px-3 py-1 rounded"
                              disabled={!stock.price}
                            >
                              Sell
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* Portfolio Tab */}
        {activeTab === 'portfolio' && (
          <div className="space-y-6">
            <PortfolioForm stocks={stocks} />
            <PortfolioTable selectedSymbol="" stocks={stocks} showSummary={true} />
          </div>
        )}
        
        {/* Trading Bot Tab */}
        {activeTab === 'tradingbot' && (
          <div>
            <TradingBot />
          </div>
        )}
        
        {/* Transactions Tab */}
        {activeTab === 'transactions' && (
          <div>
            <TransactionHistory />
          </div>
        )}
        
        {/* Wallet Tab */}
        {activeTab === 'wallet' && (
          <div>
            <Wallet onBalanceChange={setWalletBalance} showTransactions={true} />
          </div>
        )}
      </div>
    </div>
  );
}

export default App;
