import React, { useState, useEffect } from 'react';
import axios from 'axios';

function PortfolioTable() {
  const [portfolio, setPortfolio] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);

  useEffect(() => {
    axios.get('/api/stock/RELIANCE')
      .then(response => setCurrentPrice(response.data.current_price));
    axios.get('http://localhost:5000/api/portfolio')
      .then(response => setPortfolio(response.data))
      .catch(error => console.error('Error fetching portfolio:', error));
  }, []);

  return (
    <table className="w-full border">
      <thead>
        <tr>
          <th className="border p-2">Symbol</th>
          <th className="border p-2">Quantity</th>
          <th className="border p-2">Buy Price</th>
          <th className="border p-2">P&L</th>
        </tr>
      </thead>
      <tbody>
        {portfolio.map(entry => (
          <tr key={entry.id}>
            <td className="border p-2">{entry.symbol}</td>
            <td className="border p-2">{entry.quantity}</td>
            <td className="border p-2">₹{entry.buy_price}</td>
            <td className="border p-2">
              ₹{((currentPrice - entry.buy_price) * entry.quantity).toFixed(2)}
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

export default PortfolioTable;