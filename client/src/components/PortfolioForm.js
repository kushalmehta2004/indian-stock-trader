import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PortfolioForm({ stocks = [] }) {
  const [form, setForm] = useState({ 
    symbol: stocks.length > 0 ? stocks[0].symbol : '', 
    quantity: '', 
    buy_price: '' 
  });
  const [walletBalance, setWalletBalance] = useState(0);

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

  // Update the form when stocks are loaded
  useEffect(() => {
    if (stocks.length > 0 && !form.symbol) {
      setForm(prev => ({ ...prev, symbol: stocks[0].symbol }));
    }
    
    // Fetch wallet balance on component mount
    fetchWalletBalance();
  }, [stocks, form.symbol]);

  // Update buy price when stock is selected and price is available
  useEffect(() => {
    const selectedStock = stocks.find(s => s.symbol === form.symbol);
    if (selectedStock && selectedStock.price) {
      setForm(prev => ({ ...prev, buy_price: selectedStock.price.toFixed(2) }));
    }
  }, [form.symbol, stocks]);

  const handleSubmit = (e) => {
    e.preventDefault();
    
    if (!form.symbol || !form.quantity || !form.buy_price) {
      alert('Please fill in all fields');
      return;
    }
    
    const quantity = parseInt(form.quantity);
    const buyPrice = parseFloat(form.buy_price);
    
    if (quantity <= 0) {
      alert('Quantity must be greater than 0');
      return;
    }
    
    if (buyPrice <= 0) {
      alert('Buy price must be greater than 0');
      return;
    }
    
    // Calculate total cost
    const totalCost = quantity * buyPrice;
    
    // Check if wallet has enough funds
    if (totalCost > walletBalance) {
      alert(`Insufficient funds in wallet. Required: ₹${totalCost.toFixed(2)}, Available: ₹${walletBalance.toFixed(2)}`);
      return;
    }
    
    // Use the trade API instead of portfolio API to ensure wallet balance is updated
    axios.post('http://localhost:5000/api/trade', {
      symbol: form.symbol,
      action: 'buy',
      quantity: quantity,
      current_price: buyPrice,
    })
      .then(response => {
        console.log('Portfolio updated:', response.data);
        setForm({ ...form, quantity: '', buy_price: '' });
        alert(response.data.message);
        // Update wallet balance
        setWalletBalance(response.data.wallet_balance);
      })
      .catch(error => {
        console.error('Error adding portfolio entry:', error);
        alert('Failed to add portfolio entry: ' + (error.response?.data?.error || error.message));
      });
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4 p-4 border rounded bg-gray-50">
      <div className="flex flex-wrap items-end">
        <div className="mr-4 mb-2">
          <label htmlFor="symbol" className="block text-sm font-medium mb-1">Stock Symbol</label>
          <select
            id="symbol"
            value={form.symbol}
            onChange={e => setForm({ ...form, symbol: e.target.value })}
            className="border p-2 w-full rounded"
          >
            {stocks.map(stock => (
              <option key={stock.symbol} value={stock.symbol}>
                {stock.name} ({stock.symbol})
              </option>
            ))}
          </select>
        </div>
        
        <div className="mr-4 mb-2">
          <label htmlFor="quantity" className="block text-sm font-medium mb-1">Quantity</label>
          <input
            id="quantity"
            type="number"
            min="1"
            value={form.quantity}
            onChange={e => setForm({ ...form, quantity: e.target.value })}
            placeholder="Quantity"
            className="border p-2 w-full rounded"
            required
          />
        </div>
        
        <div className="mr-4 mb-2">
          <label htmlFor="buy_price" className="block text-sm font-medium mb-1">Buy Price (₹)</label>
          <input
            id="buy_price"
            type="number"
            step="0.01"
            min="0.01"
            value={form.buy_price}
            onChange={e => setForm({ ...form, buy_price: e.target.value })}
            placeholder="Buy Price"
            className="border p-2 w-full rounded"
            required
          />
        </div>
        
        <div className="mb-2">
          <button 
            type="submit" 
            className="bg-blue-500 hover:bg-blue-600 text-white p-2 rounded"
          >
            Add to Portfolio
          </button>
        </div>
      </div>
    </form>
  );
}

export default PortfolioForm;
