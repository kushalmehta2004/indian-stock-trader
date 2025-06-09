# Indian Stock Trader

A full-stack application for trading in the Indian stock market (NSE/BSE) with real-time data, AI-powered trading signals, and automated trading capabilities. Built with React, Flask, Socket.IO, SQLAlchemy, and machine learning models.

## Features

- **Real-time Stock Data**: Get live prices and technical indicators for NSE stocks
- **AI-Powered Trading Signals**: Trading signals based on machine learning predictions and technical analysis
- **Automated Trading Bot**: Configurable trading bot that executes trades based on signals with customizable risk parameters
- **Portfolio Management**: Track your holdings, transactions, and performance metrics
- **Interactive Dashboard**: Visualize performance with charts and key metrics
- **Virtual Wallet**: Test strategies with a virtual wallet before using real money
- **Responsive Design**: Works on desktop and mobile devices

## Technology Stack

### Frontend
- React.js
- Tailwind CSS for styling
- Socket.IO client for real-time updates
- Recharts for data visualization

### Backend
- Python Flask RESTful API
- SQLAlchemy ORM with SQLite database
- Socket.IO for real-time data streaming
- yfinance for market data
- scikit-learn for predictive modeling
- Technical analysis algorithms (RSI, MACD, ADX, Bollinger Bands, etc.)

## Setup and Installation

### Prerequisites
- Node.js (v14+)
- Python (v3.8+)
- pip

### Backend Setup
1. Navigate to the backend directory:
   ```
   cd backend
   ```

2. Install required packages:
   ```
   pip install -r requirements.txt
   ```

3. Run the Flask server:
   ```
   python app.py
   ```

### Frontend Setup
1. Navigate to the client directory:
   ```
   cd client
   ```

2. Install dependencies:
   ```
   npm install
   ```

3. Start the development server:
   ```
   npm start
   ```

4. For production build:
   ```
   npm run build
   ```

## Usage

1. Register/login to access the dashboard
2. Fund your virtual wallet
3. Browse stocks and analyze signals
4. Make manual trades or configure the trading bot
5. Monitor your portfolio performance

## Future Enhancements

- Integration with actual trading APIs (Zerodha, Upstox, etc.)
- Enhanced ML models with deep learning
- Backtesting module for strategy validation
- Social trading features
- Mobile app development

## License

MIT License - See LICENSE file for details