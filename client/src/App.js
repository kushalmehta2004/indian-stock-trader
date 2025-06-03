import React, { useState, useEffect } from 'react';
import axios from 'axios';
import io from 'socket.io-client';
import StockChart from './components/StockChart';
import PortfolioForm from './components/PortfolioForm';
import PortfolioTable from './components/PortfolioTable';

const socket = io('http://localhost:5000');

function App() {
  const [stocks, setStocks] = useState([]);
  const [selectedStock, setSelectedStock] = useState('');

  useEffect(() => {
    axios.get('/api/stocks')
      .then(response => {
        setStocks(response.data.map(stock => ({ ...stock, price: null })));
        if (response.data.length > 0) setSelectedStock(response.data[0].symbol);
      })
      .catch(error => console.error('Error fetching stocks:', error));

    socket.on('price_update', (data) => {
      console.log('Received price update:', data);
      setStocks(prevStocks =>
        prevStocks.map(stock =>
          stock.symbol === data.symbol ? { ...stock, price: data.current_price } : stock
        )
      );
    });

    return () => socket.off('price_update');
  }, []);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Indian Stock Market Dashboard</h1>
      <div className="mb-4">
        <h2 className="text-xl font-semibold mb-2">Stock List</h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-4">
          {stocks.map(stock => (
            <div
              key={stock.symbol}
              className={`p-4 border rounded cursor-pointer ${selectedStock === stock.symbol ? 'bg-blue-100' : ''}`}
              onClick={() => setSelectedStock(stock.symbol)}
            >
              <p className="font-semibold">{stock.name} ({stock.symbol})</p>
              <p>Price: ₹{stock.price ? stock.price.toFixed(2) : 'Loading...'}</p>
              <p>Sector: {stock.sector}</p>
            </div>
          ))}
        </div>
      </div>
      {selectedStock && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <h2 className="text-xl font-semibold mb-2">{selectedStock} Chart</h2>
            <StockChart symbol={selectedStock} />
          </div>
          <div>
            <h2 className="text-xl font-semibold mb-2">Portfolio</h2>
            <PortfolioForm />
            <PortfolioTable selectedSymbol={selectedStock} />
          </div>
        </div>
      )}
    </div>
  );
}

export default App;
