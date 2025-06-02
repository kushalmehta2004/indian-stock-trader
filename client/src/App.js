import React from 'react';
import './index.css';
import StockChart from './components/StockChart';
import PortfolioForm from './components/PortfolioForm';
import PortfolioTable from './components/PortfolioTable';

function App() {
  return (
    <div className="container mx-auto p-4">
      <h1 className="text-3xl font-bold mb-4">Indian Stock Trader</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <h2 className="text-xl font-semibold mb-2">RELIANCE Stock</h2>
          <StockChart />
        </div>
        <div>
          <h2 className="text-xl font-semibold mb-2">Portfolio</h2>
          <PortfolioForm />
          <PortfolioTable />
        </div>
      </div>
    </div>
  );
}

export default App;