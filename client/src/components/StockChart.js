import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { Line } from 'react-chartjs-2';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend } from 'chart.js';
import 'chartjs-adapter-date-fns'; // For date handling

ChartJS.register(LineElement, PointElement, LinearScale, TimeScale, Title, Tooltip, Legend);

function StockChart({ symbol }) {
  const [stockData, setStockData] = useState([]);
  const [currentPrice, setCurrentPrice] = useState(0);
  const [signal, setSignal] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showChart, setShowChart] = useState(true);

  useEffect(() => {
    if (!symbol) return;
    
    setLoading(true);
    setError(null);
    
    axios.get(`http://localhost:5000/api/stock/${symbol}`)
      .then(response => {
        console.log(`Stock data for ${symbol}:`, response.data);
        setStockData(response.data.prices || []);
        setCurrentPrice(response.data.current_price || 0);
        setSignal(response.data.signal || 'Hold');
        setLoading(false);
      })
      .catch(error => {
        console.error(`Error fetching stock data for ${symbol}:`, error);
        setError(`Failed to load data for ${symbol}`);
        setLoading(false);
      });
  }, [symbol]);

  const chartData = {
    labels: stockData.map(d => d.date),
    datasets: [
      {
        label: 'Price',
        data: stockData.map(d => d.close),
        borderColor: 'blue',
        fill: false,
      },
      {
        label: '50-day SMA',
        data: stockData.map(d => d.sma50),
        borderColor: 'green',
        fill: false,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false, // Allow chart to fill container
    scales: {
      x: { 
        type: 'time', 
        time: { unit: 'day' },
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
      y: { 
        beginAtZero: false,
        grid: {
          color: 'rgba(0, 0, 0, 0.1)'
        }
      },
    },
    plugins: {
      title: {
        display: true,
        text: `${symbol} Stock Price History`,
        font: {
          size: 20,
          weight: 'bold'
        },
        padding: {
          top: 10,
          bottom: 20
        }
      },
      tooltip: {
        callbacks: {
          label: function(context) {
            return `₹${context.parsed.y.toFixed(2)}`;
          }
        },
        backgroundColor: 'rgba(0, 0, 0, 0.8)',
        titleFont: {
          size: 14
        },
        bodyFont: {
          size: 14
        },
        padding: 10
      },
      legend: {
        labels: {
          font: {
            size: 14
          }
        }
      }
    }
  };

  if (!symbol) {
    return <div className="p-4 text-center">Please select a stock to view chart</div>;
  }
  
  if (loading) {
    return <div className="p-4 text-center">Loading chart data...</div>;
  }

  if (error) {
    return <div className="p-4 text-center text-red-500">{error}</div>;
  }

  if (stockData.length === 0) {
    return <div className="p-4 text-center">No historical data available for {symbol}</div>;
  }

  // Check if dark mode is enabled
  const isDarkMode = document.documentElement.classList.contains('dark');
  
  // Update chart options for dark mode
  if (isDarkMode) {
    options.scales.x.grid.color = 'rgba(255, 255, 255, 0.1)';
    options.scales.y.grid.color = 'rgba(255, 255, 255, 0.1)';
    options.scales.x.ticks.color = 'rgba(255, 255, 255, 0.7)';
    options.scales.y.ticks.color = 'rgba(255, 255, 255, 0.7)';
    options.plugins.title.color = 'rgba(255, 255, 255, 0.9)';
    options.plugins.legend.labels.color = 'rgba(255, 255, 255, 0.9)';
  }

  return (
    <div className={`border rounded p-6 shadow-lg ${isDarkMode ? 'bg-gray-800 border-gray-700' : 'bg-white'}`}>
      <div className="flex flex-wrap justify-between items-center mb-6">
        <div>
          <p className="text-xl">Current Price: <span className="font-bold text-2xl">₹{currentPrice.toFixed(2)}</span></p>
        </div>
        <div className="flex items-center mt-2 sm:mt-0">
          <p className="text-xl mr-4">
            Signal: 
            <span className={`ml-2 font-bold px-4 py-2 rounded ${
              signal === 'Buy' 
                ? 'bg-green-500 text-white' 
                : signal === 'Sell' 
                  ? 'bg-red-500 text-white' 
                  : 'bg-yellow-500 text-white'
            }`}>
              {signal}
            </span>
          </p>
          <button 
            onClick={() => setShowChart(!showChart)}
            className="bg-blue-500 hover:bg-blue-600 text-white px-3 py-1 rounded"
          >
            {showChart ? 'Hide Chart' : 'Show Chart'}
          </button>
        </div>
      </div>
      {showChart && (
        <div className="h-[500px]"> {/* Fixed height container for the chart */}
          <Line data={chartData} options={options} />
        </div>
      )}
    </div>
  );
}

export default StockChart;
