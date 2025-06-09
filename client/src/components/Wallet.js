import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import { FaInfoCircle } from 'react-icons/fa';

const socket = io('http://localhost:5000', {
  reconnection: true,
  reconnectionAttempts: 5,
  reconnectionDelay: 1000
});

function Wallet({ onBalanceChange }) {
  const [balance, setBalance] = useState(0);
  const [amount, setAmount] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showTransactions, setShowTransactions] = useState(false);
  const [transactions, setTransactions] = useState([]);
  const [transactionsLoading, setTransactionsLoading] = useState(false);

  // Fetch wallet balance
  const fetchWalletBalance = () => {
    setLoading(true);
    setError(null);
    
    axios.get('http://localhost:5000/api/wallet')
      .then(response => {
        setBalance(response.data.balance);
        setLoading(false);
        if (onBalanceChange) {
          onBalanceChange(response.data.balance);
        }
      })
      .catch(error => {
        console.error('Error fetching wallet balance:', error);
        setError('Failed to load wallet balance');
        setLoading(false);
      });
  };

  // Fetch transactions
  const fetchTransactions = () => {
    if (!showTransactions) return;
    
    setTransactionsLoading(true);
    axios.get('http://localhost:5000/api/transactions')
      .then(response => {
        setTransactions(response.data);
        setTransactionsLoading(false);
      })
      .catch(error => {
        console.error('Error fetching transactions:', error);
        setTransactionsLoading(false);
      });
  };

  // Listen for socket events
  useEffect(() => {
    // Listen for transaction events
    socket.on('transaction_executed', (data) => {
      console.log('Transaction executed:', data);
      setBalance(data.wallet_balance);
      if (onBalanceChange) {
        onBalanceChange(data.wallet_balance);
      }
      if (showTransactions) {
        fetchTransactions();
      }
    });
    
    // Listen for trade events
    socket.on('trade_executed', (data) => {
      console.log('Trade executed:', data);
      setBalance(data.wallet_balance);
      if (onBalanceChange) {
        onBalanceChange(data.wallet_balance);
      }
      if (showTransactions) {
        fetchTransactions();
      }
    });
    
    return () => {
      socket.off('transaction_executed');
      socket.off('trade_executed');
    };
  }, [showTransactions, onBalanceChange]);

  // Initial data fetch
  useEffect(() => {
    fetchWalletBalance();
  }, []);

  // Fetch transactions when showTransactions changes
  useEffect(() => {
    fetchTransactions();
  }, [showTransactions]);

  // Handle deposit
  const handleDeposit = (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    axios.post('http://localhost:5000/api/wallet/deposit', {
      amount: parseFloat(amount),
      description: 'Manual deposit'
    })
      .then(response => {
        setBalance(response.data.balance);
        setAmount('');
        alert(response.data.message);
        if (onBalanceChange) {
          onBalanceChange(response.data.balance);
        }
        if (showTransactions) {
          fetchTransactions();
        }
      })
      .catch(error => {
        console.error('Error depositing to wallet:', error);
        alert('Failed to deposit: ' + (error.response?.data?.error || error.message));
      });
  };

  // Handle withdrawal
  const handleWithdrawal = (e) => {
    e.preventDefault();
    
    if (!amount || parseFloat(amount) <= 0) {
      alert('Please enter a valid amount');
      return;
    }
    
    if (parseFloat(amount) > balance) {
      alert('Insufficient funds in wallet');
      return;
    }
    
    axios.post('http://localhost:5000/api/wallet/withdraw', {
      amount: parseFloat(amount),
      description: 'Manual withdrawal'
    })
      .then(response => {
        setBalance(response.data.balance);
        setAmount('');
        alert(response.data.message);
        if (onBalanceChange) {
          onBalanceChange(response.data.balance);
        }
        if (showTransactions) {
          fetchTransactions();
        }
      })
      .catch(error => {
        console.error('Error withdrawing from wallet:', error);
        alert('Failed to withdraw: ' + (error.response?.data?.error || error.message));
      });
  };

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

  return (
    <div className="border rounded p-4 bg-white shadow-md dark:bg-gray-800 dark:text-white dark:border-gray-700">
      <h2 className="text-xl font-bold mb-4 flex items-center">
        Trading Wallet
        <FaInfoCircle 
          className="ml-2 text-gray-500 hover:text-blue-500 cursor-help transition-colors dark:text-gray-400" 
          data-tooltip-id="info-tooltip" 
          data-tooltip-content="Your virtual wallet for trading. Deposit and withdraw funds to manage your trading capital."
        />
      </h2>
      
      {loading ? (
        <div className="text-center p-4">Loading wallet data...</div>
      ) : error ? (
        <div className="text-center text-red-500 p-4">
          {error}
          <button 
            onClick={fetchWalletBalance} 
            className="ml-2 bg-blue-500 text-white px-2 py-1 rounded text-sm"
          >
            Retry
          </button>
        </div>
      ) : (
        <>
          <div className="mb-4 p-4 bg-gray-50 rounded dark:bg-gray-700">
            <div className="text-lg text-gray-600 dark:text-gray-300 flex items-center">
              Available Balance
              <FaInfoCircle 
                className="ml-2 text-gray-500 hover:text-blue-500 cursor-help transition-colors dark:text-gray-400" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="Current funds available for trading activities"
              />
            </div>
            <div className="text-3xl font-bold dark:text-white">₹{balance.toFixed(2)}</div>
          </div>
          
          <form className="mb-4">
            <div className="flex flex-wrap items-end">
              <div className="mr-4 mb-2 flex-grow">
                <label htmlFor="amount" className="block text-sm font-medium mb-1 flex items-center">
                  Amount (₹)
                  <FaInfoCircle 
                    className="ml-2 text-gray-500 hover:text-blue-500 cursor-help transition-colors dark:text-gray-400" 
                    data-tooltip-id="info-tooltip" 
                    data-tooltip-content="Enter the amount to deposit or withdraw from your wallet"
                  />
                </label>
                <input
                  id="amount"
                  type="number"
                  min="1"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="Enter amount"
                  className="border p-2 w-full rounded dark:bg-gray-700 dark:border-gray-600 dark:text-white"
                  required
                />
              </div>
              
              <div className="flex mb-2">
                <button 
                  onClick={handleDeposit}
                  className="bg-green-500 hover:bg-green-600 text-white p-2 rounded mr-2 flex items-center"
                  data-tooltip-id="info-tooltip"
                  data-tooltip-content="Add funds to your wallet"
                >
                  Deposit
                </button>
                <button 
                  onClick={handleWithdrawal}
                  className="bg-red-500 hover:bg-red-600 text-white p-2 rounded flex items-center"
                  disabled={balance <= 0}
                  data-tooltip-id="info-tooltip"
                  data-tooltip-content="Remove funds from your wallet"
                >
                  Withdraw
                </button>
              </div>
            </div>
          </form>
          
          <div className="mt-4">
            <button 
              onClick={() => setShowTransactions(!showTransactions)}
              className="text-blue-500 hover:text-blue-700 text-sm dark:text-blue-400 dark:hover:text-blue-300 flex items-center"
            >
              {showTransactions ? 'Hide Transaction History' : 'Show Transaction History'}
              <FaInfoCircle 
                className="ml-2 text-gray-500 hover:text-blue-500 cursor-help transition-colors dark:text-gray-400" 
                data-tooltip-id="info-tooltip" 
                data-tooltip-content="View all past transactions including deposits, withdrawals, and trades"
              />
            </button>
            
            {showTransactions && (
              <div className="mt-2">
                <h3 className="text-lg font-semibold mb-2">Transaction History</h3>
                
                {transactionsLoading ? (
                  <div className="text-center p-2">Loading transactions...</div>
                ) : transactions.length === 0 ? (
                  <div className="text-center p-2 text-gray-500 dark:text-gray-400">No transactions found</div>
                ) : (
                  <div className="max-h-60 overflow-y-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-gray-100 dark:bg-gray-700">
                        <tr>
                          <th className="p-2 text-left">Date</th>
                          <th className="p-2 text-left">Type</th>
                          <th className="p-2 text-right">Amount</th>
                          <th className="p-2 text-left">Details</th>
                        </tr>
                      </thead>
                      <tbody className="dark:text-white">
                        {transactions.map(transaction => (
                          <tr key={transaction.transaction_id} className="border-b dark:border-gray-700">
                            <td className="p-2">{formatDate(transaction.timestamp)}</td>
                            <td className={`p-2 font-medium ${getTransactionTypeColor(transaction.type)}`}>
                              {transaction.type.charAt(0).toUpperCase() + transaction.type.slice(1)}
                            </td>
                            <td className={`p-2 text-right font-medium ${
                              transaction.type === 'deposit' || transaction.type === 'sell' 
                                ? 'text-green-600 dark:text-green-400' 
                                : 'text-red-600 dark:text-red-400'
                            }`}>
                              {transaction.type === 'deposit' || transaction.type === 'sell' ? '+' : '-'}
                              ₹{transaction.amount.toFixed(2)}
                            </td>
                            <td className="p-2">{transaction.description}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

export default Wallet;