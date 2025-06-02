import React, { useState } from 'react';
import axios from 'axios';

function PortfolioForm() {
  const [form, setForm] = useState({ symbol: 'RELIANCE', quantity: '', buy_price: '' });

  const handleSubmit = (e) => {
    e.preventDefault();
    axios.post('http://localhost:5000/api/portfolio', {
      symbol: form.symbol,
      quantity: parseInt(form.quantity),
      buy_price: parseFloat(form.buy_price),
    })
      .then(() => {
        setForm({ symbol: 'RELIANCE', quantity: '', buy_price: '' });
        alert('Portfolio entry added!');
      })
      .catch(error => console.error('Error adding portfolio entry:', error));
  };

  return (
    <form onSubmit={handleSubmit} className="mb-4">
      <input
        type="text"
        value={form.symbol}
        onChange={e => setForm({ ...form, symbol: e.target.value })}
        placeholder="Symbol"
        className="border p-2 mr-2"
      />
      <input
        type="number"
        value={form.quantity}
        onChange={e => setForm({ ...form, quantity: e.target.value })}
        placeholder="Quantity"
        className="border p-2 mr-2"
      />
      <input
        type="number"
        value={form.buy_price}
        onChange={e => setForm({ ...form, buy_price: e.target.value })}
        placeholder="Buy Price"
        className="border p-2 mr-2"
      />
      <button type="submit" className="bg-blue-500 text-white p-2 rounded">Add</button>
    </form>
  );
}

export default PortfolioForm;
