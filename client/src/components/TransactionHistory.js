import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';

const socket = io('http://localhost:5000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function TransactionHistory() {
  const [transactions, setTransactions] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [filter, setFilter] = useState('all'); // 'all', 'manual', 'bot'

  // Fetch transactions
  const fetchTransactions = () => {
    setLoading(true);
    setError(null);
    
    axios.get('http://localhost:5000/api/transactions')
      .then(response => {
        setTransactions(response.data);
        setLoading(false);
      })
      .catch(error => {
        console.error('Error fetching transactions:', error);
        setError('Failed to load transaction history');
        setLoading(false);
      });
  };

  // Listen for socket events
  useEffect(() => {
    // Listen for transaction events
    socket.on('transaction_executed', (data) => {
      console.log('Transaction executed:', data);
      fetchTransactions();
    });
    
    // Listen for trade events
    socket.on('trade_executed', (data) => {
      console.log('Trade executed:', data);
      fetchTransactions();
    });
    
    return () => {
      socket.off('transaction_executed');
      socket.off('trade_executed');
    };
  }, []);

  // Initial data fetch
  useEffect(() => {
    fetchTransactions();
  }, []);

  // Format date
  const formatDate = (dateString) => {
    const date = new Date(dateString);
    return date.toLocaleString();
  };

  // Get transaction type color
  const getTransactionTypeColor = (type) => {
    switch (type) {
      case 'deposit':
        return 'text-green-600';
      case 'withdrawal':
        return 'text-red-600';
      case 'buy':
        return 'text-blue-600';
      case 'sell':
        return 'text-purple-600';
      default:
        return 'text-gray-600';
    }
  };

  // Filter transactions
  const filteredTransactions = transactions.filter(transaction => {
    if (filter === 'all') return true;
    if (filter === 'bot') return transaction.description && transaction.description.includes('[BOT]');
    if (filter === 'manual') return !transaction.description || !transaction.description.includes('[BOT]');
    return true;
  });

  // Group transactions by date
  const groupedTransactions = filteredTransactions.reduce((groups, transaction) => {
    const date = new Date(transaction.timestamp).toLocaleDateString();
    if (!groups[date]) {
      groups[date] = [];
    }
    groups[date].push(transaction);
    return groups;
  }, {});

  return (
    <div className="border rounded p-4 bg-white shadow-md">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold">Transaction History</h2>
        <div className="flex">
          <button
            onClick={() => setFilter('all')}
            className={`px-3 py-1 rounded-l ${
              filter === 'all' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            All
          </button>
          <button
            onClick={() => setFilter('manual')}
            className={`px-3 py-1 ${
              filter === 'manual' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Manual
          </button>
          <button
            onClick={() => setFilter('bot')}
            className={`px-3 py-1 rounded-r ${
              filter === 'bot' 
                ? 'bg-blue-500 text-white' 
                : 'bg-gray-200 text-gray-700 hover:bg-gray-300'
            }`}
          >
            Bot
          </button>
        </div>
      </div>
      
      {loading ? (
        <div className="text-center p-4">Loading transactions...</div>
      ) : error ? (
        <div className="text-center text-red-500 p-4">
          {error}
          <button 
            onClick={fetchTransactions} 
            className="ml-2 bg-blue-500 text-white px-2 py-1 rounded text-sm"
          >
            Retry
          </button>
        </div>
      ) : filteredTransactions.length === 0 ? (
        <div className="text-center p-4 text-gray-500">No transactions found</div>
      ) : (
        <div className="max-h-96 overflow-y-auto">
          {Object.keys(groupedTransactions).sort((a, b) => new Date(b) - new Date(a)).map(date => (
            <div key={date} className="mb-4">
              <h3 className="text-sm font-semibold bg-gray-100 p-2 sticky top-0">{date}</h3>
              <table className="w-full text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="p-2 text-left">S.No</th>
                    <th className="p-2 text-left">Time</th>
                    <th className="p-2 text-left">Type</th>
                    <th className="p-2 text-right">Amount</th>
                    <th className="p-2 text-left">Details</th>
                  </tr>
                </thead>
                <tbody>
                  {groupedTransactions[date].map((transaction, index) => (
                    <tr 
                      key={transaction.transaction_id} 
                      className={`border-b ${
                        transaction.description && transaction.description.includes('[BOT]')
                          ? 'bg-blue-50'
                          : ''
                      }`}
                    >
                      <td className="p-2 font-medium">
                        {index + 1}
                      </td>
                      <td className="p-2">
                        {new Date(transaction.timestamp).toLocaleTimeString()}
                      </td>
                      <td className={`p-2 font-medium ${getTransactionTypeColor(transaction.type)}`}>
                        {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                      </td>
                      <td className={`p-2 text-right font-medium ${
                        transaction.type === 'deposit' || transaction.type === 'sell' 
                          ? 'text-green-600' 
                          : 'text-red-600'
                      }`}>
                        {transaction.type === 'deposit' || transaction.type === 'sell' ? '+' : '-'}
                        ₹{transaction.amount.toFixed(2)}
                      </td>
                      <td className="p-2">
                        {transaction.description && transaction.description.includes('[BOT]') && (
                          <span className="inline-block bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded mr-2">
                            BOT
                          </span>
                        )}
                        {transaction.description}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export default TransactionHistory;