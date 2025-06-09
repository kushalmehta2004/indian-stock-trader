from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO
import yfinance as yf
import pandas as pd
import numpy as np
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime, Text
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from dotenv import load_dotenv
import os
from flask_cors import CORS
import json
import threading
import time
import joblib
import uuid

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)
load_dotenv()
Base = declarative_base()
engine = create_engine('sqlite:///data.db')
Session = sessionmaker(bind=engine)


class Portfolio(Base):
    __tablename__ = 'portfolio'
    id = Column(Integer, primary_key=True)
    symbol = Column(String)
    quantity = Column(Integer)
    buy_price = Column(Float)
    buy_date = Column(DateTime)


class Wallet(Base):
    __tablename__ = 'wallet'
    id = Column(Integer, primary_key=True)
    balance = Column(Float, default=0.0)
    

class Transaction(Base):
    __tablename__ = 'transactions'
    id = Column(Integer, primary_key=True)
    transaction_id = Column(String, unique=True)
    type = Column(String)  # 'deposit', 'withdrawal', 'buy', 'sell'
    amount = Column(Float)
    symbol = Column(String, nullable=True)  # For buy/sell transactions
    quantity = Column(Integer, nullable=True)  # For buy/sell transactions
    price = Column(Float, nullable=True)  # For buy/sell transactions
    timestamp = Column(DateTime, default=datetime.now)
    description = Column(Text, nullable=True)


class TradingBot(Base):
    __tablename__ = 'trading_bot'
    id = Column(Integer, primary_key=True)
    is_active = Column(Integer, default=0)  # 0 = inactive, 1 = active
    max_investment_per_trade = Column(Float, default=5000.0)  # Maximum amount to invest in a single trade
    profit_target_percentage = Column(Float, default=5.0)  # Target profit percentage
    stop_loss_percentage = Column(Float, default=3.0)  # Stop loss percentage
    max_trades_per_day = Column(Integer, default=5)  # Maximum number of trades per day
    max_open_positions = Column(Integer, default=3)  # Maximum number of open positions
    last_updated = Column(DateTime, default=datetime.now)


Base.metadata.create_all(engine)

# Initialize wallet and trading bot if they don't exist
session = Session()
wallet = session.query(Wallet).first()
if not wallet:
    wallet = Wallet(balance=0.0)
    session.add(wallet)
    session.commit()

trading_bot = session.query(TradingBot).first()
if not trading_bot:
    trading_bot = TradingBot(
        is_active=0,
        max_investment_per_trade=5000.0,
        profit_target_percentage=5.0,
        stop_loss_percentage=3.0,
        max_trades_per_day=5,
        max_open_positions=30
    )
    session.add(trading_bot)
    session.commit()
session.close()


def calculate_technical_indicators(data):
    # Basic Moving Averages
    data['SMA5'] = data['Close'].rolling(window=5).mean()
    data['SMA10'] = data['Close'].rolling(window=10).mean()
    data['SMA20'] = data['Close'].rolling(window=20).mean()
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    data['SMA200'] = data['Close'].rolling(window=200).mean()
    
    # Exponential Moving Averages
    data['EMA5'] = data['Close'].ewm(span=5, adjust=False).mean()
    data['EMA10'] = data['Close'].ewm(span=10, adjust=False).mean()
    data['EMA20'] = data['Close'].ewm(span=20, adjust=False).mean()
    
    # RSI Calculation
    delta = data['Close'].diff()
    gain = delta.where(delta > 0, 0).rolling(window=14).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=14).mean()
    rs = gain / loss
    data['RSI'] = 100 - (100 / (1 + rs))
    
    # MACD
    exp1 = data['Close'].ewm(span=12, adjust=False).mean()
    exp2 = data['Close'].ewm(span=26, adjust=False).mean()
    data['MACD'] = exp1 - exp2
    data['Signal_Line'] = data['MACD'].ewm(span=9, adjust=False).mean()
    data['MACD_Hist'] = data['MACD'] - data['Signal_Line']
    
    # Bollinger Bands
    data['BB_Mid'] = data['Close'].rolling(window=20).mean()
    data['BB_Std'] = data['Close'].rolling(window=20).std()
    data['BB_Upper'] = data['BB_Mid'] + 2 * data['BB_Std']
    data['BB_Lower'] = data['BB_Mid'] - 2 * data['BB_Std']
    data['BB_Width'] = (data['BB_Upper'] - data['BB_Lower']) / data['BB_Mid']
    data['BB_Pct'] = (data['Close'] - data['BB_Lower']) / (data['BB_Upper'] - data['BB_Lower'])
    
    # Stochastic Oscillator
    data['14-high'] = data['High'].rolling(14).max()
    data['14-low'] = data['Low'].rolling(14).min()
    data['%K'] = (data['Close'] - data['14-low']) * 100 / (data['14-high'] - data['14-low'])
    data['%D'] = data['%K'].rolling(3).mean()
    
    # Average True Range (ATR)
    data['TR'] = np.maximum(
        data['High'] - data['Low'],
        np.maximum(
            abs(data['High'] - data['Close'].shift(1)),
            abs(data['Low'] - data['Close'].shift(1))
        )
    )
    data['ATR'] = data['TR'].rolling(14).mean()
    
    # On-Balance Volume (OBV)
    data['OBV'] = (np.sign(data['Close'].diff()) * data['Volume']).fillna(0).cumsum()
    
    # Price and Volume Metrics
    for lag in range(1, 6):
        data[f'Close_Lag_{lag}'] = data['Close'].shift(lag)
        data[f'Volume_Lag_{lag}'] = data['Volume'].shift(lag)
    
    data['Pct_Change'] = data['Close'].pct_change()
    data['Volume_Pct_Change'] = data['Volume'].pct_change()
    
    # Price Momentum
    data['ROC_5'] = data['Close'].pct_change(periods=5) * 100  # 5-day Rate of Change
    data['ROC_10'] = data['Close'].pct_change(periods=10) * 100  # 10-day Rate of Change
    data['ROC_20'] = data['Close'].pct_change(periods=20) * 100  # 20-day Rate of Change
    
    # Volatility Indicators
    data['Daily_Return'] = data['Close'].pct_change()
    data['Volatility_20'] = data['Daily_Return'].rolling(window=20).std() * np.sqrt(252)  # Annualized
    
    # Volume Indicators
    data['Volume_SMA_20'] = data['Volume'].rolling(window=20).mean()
    data['Volume_Ratio'] = data['Volume'] / data['Volume_SMA_20']
    
    # Trend Indicators
    data['ADX'] = calculate_adx(data)
    
    # Support and Resistance
    data['Support_Level'] = data['Low'].rolling(window=20).min()
    data['Resistance_Level'] = data['High'].rolling(window=20).max()
    
    return data

def calculate_adx(data, period=14):
    """Calculate the Average Directional Index (ADX)"""
    try:
        # True Range
        data['TR'] = np.maximum(
            data['High'] - data['Low'],
            np.maximum(
                abs(data['High'] - data['Close'].shift(1)),
                abs(data['Low'] - data['Close'].shift(1))
            )
        )
        
        # Directional Movement
        data['DM_plus'] = np.where(
            (data['High'] - data['High'].shift(1)) > (data['Low'].shift(1) - data['Low']),
            np.maximum(data['High'] - data['High'].shift(1), 0),
            0
        )
        
        data['DM_minus'] = np.where(
            (data['Low'].shift(1) - data['Low']) > (data['High'] - data['High'].shift(1)),
            np.maximum(data['Low'].shift(1) - data['Low'], 0),
            0
        )
        
        # Smoothed TR and DM
        data['ATR'] = data['TR'].rolling(window=period).mean()
        data['DM_plus_smooth'] = data['DM_plus'].rolling(window=period).mean()
        data['DM_minus_smooth'] = data['DM_minus'].rolling(window=period).mean()
        
        # Directional Indicators
        data['DI_plus'] = 100 * data['DM_plus_smooth'] / data['ATR']
        data['DI_minus'] = 100 * data['DM_minus_smooth'] / data['ATR']
        
        # Directional Index
        data['DX'] = 100 * abs(data['DI_plus'] - data['DI_minus']) / (data['DI_plus'] + data['DI_minus'])
        
        # Average Directional Index
        data['ADX'] = data['DX'].rolling(window=period).mean()
        
        return data['ADX']
    except Exception as e:
        print(f"Error calculating ADX: {e}")
        return pd.Series(np.nan, index=data.index)


def predict_signal(symbol, data):
    try:
        # Try to use the pre-trained model if available
        try:
            model_data = joblib.load(f'models/{symbol}_model.pkl')
            
            # Handle both old model format (direct model) and new format (dict with model and features)
            if isinstance(model_data, dict) and 'model' in model_data:
                model = model_data['model']
                features = model_data['features']
                print(f"Using new model format for {symbol} (type: {model_data.get('model_type', 'Unknown')})")
            else:
                model = model_data
                features = [
                    'SMA50', 'SMA200', 'RSI', 'MACD', 'Signal_Line', 'BB_Upper', 'BB_Lower',
                    'Close_Lag_1', 'Close_Lag_2', 'Close_Lag_3', 'Close_Lag_4', 'Close_Lag_5',
                    'Volume_Lag_1', 'Volume_Lag_2', 'Volume_Lag_3', 'Volume_Lag_4', 'Volume_Lag_5',
                    'Pct_Change'
                ]
                print(f"Using original model format for {symbol}")
            
            # Ensure all required features exist in the data
            for feature in features:
                if feature not in data.columns:
                    print(f"Warning: Feature {feature} not found in data for {symbol}, calculating it")
                    # Calculate missing features on-the-fly if possible
                    if feature == 'SMA5':
                        data['SMA5'] = data['Close'].rolling(window=5).mean()
                    elif feature == 'SMA20':
                        data['SMA20'] = data['Close'].rolling(window=20).mean()
                    elif feature == 'MACD_Hist':
                        if 'MACD' in data.columns and 'Signal_Line' in data.columns:
                            data['MACD_Hist'] = data['MACD'] - data['Signal_Line']
                    elif feature == 'BB_Width':
                        if 'BB_Upper' in data.columns and 'BB_Lower' in data.columns and 'BB_Mid' in data.columns:
                            data['BB_Width'] = (data['BB_Upper'] - data['BB_Lower']) / data['BB_Mid']
                    elif feature.startswith('Close_Change_'):
                        lag = int(feature.split('_')[-1])
                        lag_col = f'Close_Lag_{lag}'
                        if lag_col in data.columns:
                            data[feature] = data['Close'] / data[lag_col] - 1
                    elif feature == 'Volatility_20':
                        data['Volatility_20'] = data['Pct_Change'].rolling(window=20).std()
                    elif feature == '%K':
                        data['Lowest_14'] = data['Low'].rolling(window=14).min()
                        data['Highest_14'] = data['High'].rolling(window=14).max()
                        data['%K'] = 100 * ((data['Close'] - data['Lowest_14']) / 
                                        (data['Highest_14'] - data['Lowest_14']))
                    elif feature == '%D':
                        if '%K' in data.columns:
                            data['%D'] = data['%K'].rolling(window=3).mean()
                    elif feature == 'ROC_5':
                        data['ROC_5'] = data['Close'].pct_change(periods=5)
                    elif feature == 'ROC_20':
                        data['ROC_20'] = data['Close'].pct_change(periods=20)
                    elif feature == 'Volume_Ratio':
                        data['Volume_Ratio'] = data['Volume'] / data['Volume'].rolling(window=20).mean()
            
            # Get the latest data with required features
            latest_data = data.tail(1)[features]
            
            if not latest_data.isna().any().any():
                prediction = model.predict(latest_data)[0]
                model_signal = 'Buy' if prediction == 1 else 'Sell' if prediction == -1 else 'Hold'
                print(f"Model prediction for {symbol}: {model_signal}")
            else:
                print(f"Warning: NaN values in latest data for {symbol}, defaulting to Hold")
                model_signal = 'Hold'
        except Exception as model_error:
            print(f"Model error for {symbol}, using advanced rule-based system: {model_error}")
            model_signal = 'Hold'
        
        # Advanced rule-based system as a fallback and to enhance model predictions
        if len(data) < 50:  # Need enough data for reliable signals
            return 'Hold'
            
        latest = data.iloc[-1]
        prev = data.iloc[-2]
        
        # Initialize score system (positive = buy, negative = sell)
        buy_score = 0
        sell_score = 0
        
        # 1. Moving Average Crossovers
        try:
            if latest['SMA5'] > latest['SMA20'] and prev['SMA5'] <= prev['SMA20']:
                buy_score += 2  # Short-term MA crosses above medium-term MA
            elif latest['SMA5'] < latest['SMA20'] and prev['SMA5'] >= prev['SMA20']:
                sell_score += 2  # Short-term MA crosses below medium-term MA
                
            if latest['SMA20'] > latest['SMA50'] and prev['SMA20'] <= prev['SMA50']:
                buy_score += 1  # Medium-term MA crosses above long-term MA
            elif latest['SMA20'] < latest['SMA50'] and prev['SMA20'] >= prev['SMA50']:
                sell_score += 1  # Medium-term MA crosses below long-term MA
                
            # Golden Cross / Death Cross (strong signals)
            if latest['SMA50'] > latest['SMA200'] and prev['SMA50'] <= prev['SMA200']:
                buy_score += 3  # Golden Cross
            elif latest['SMA50'] < latest['SMA200'] and prev['SMA50'] >= prev['SMA200']:
                sell_score += 3  # Death Cross
        except Exception as e:
            print(f"MA analysis error for {symbol}: {e}")
        
        # 2. RSI Conditions
        try:
            if latest['RSI'] < 30:
                buy_score += 2  # Oversold condition
            elif latest['RSI'] > 70:
                sell_score += 2  # Overbought condition
            elif 30 <= latest['RSI'] < 45:
                buy_score += 1  # Approaching oversold but not extreme
            elif 55 < latest['RSI'] <= 70:
                sell_score += 1  # Approaching overbought but not extreme
                
            # RSI Divergence (advanced)
            if latest['RSI'] > prev['RSI'] and latest['Close'] < prev['Close']:
                buy_score += 1  # Bullish divergence
            elif latest['RSI'] < prev['RSI'] and latest['Close'] > prev['Close']:
                sell_score += 1  # Bearish divergence
        except Exception as e:
            print(f"RSI analysis error for {symbol}: {e}")
            
        # 3. MACD Signal
        try:
            if latest['MACD'] > latest['Signal_Line'] and prev['MACD'] <= prev['Signal_Line']:
                buy_score += 2  # MACD crosses above signal line
            elif latest['MACD'] < latest['Signal_Line'] and prev['MACD'] >= prev['Signal_Line']:
                sell_score += 2  # MACD crosses below signal line
                
            # MACD Histogram
            if 'MACD_Hist' in latest:
                if latest['MACD_Hist'] > 0 and prev['MACD_Hist'] <= 0:
                    buy_score += 1  # MACD histogram turns positive
                elif latest['MACD_Hist'] < 0 and prev['MACD_Hist'] >= 0:
                    sell_score += 1  # MACD histogram turns negative
        except Exception as e:
            print(f"MACD analysis error for {symbol}: {e}")
            
        # 4. Bollinger Bands
        try:
            if latest['Close'] < latest['BB_Lower']:
                buy_score += 1  # Price below lower band (potential bounce)
            elif latest['Close'] > latest['BB_Upper']:
                sell_score += 1  # Price above upper band (potential reversal)
                
            # Bollinger Band Squeeze (volatility contraction)
            if 'BB_Width' in latest:
                bb_width_avg = data['BB_Width'].rolling(window=20).mean().iloc[-1]
                if latest['BB_Width'] < bb_width_avg * 0.8:
                    # Tight bands indicate potential breakout
                    if latest['Close'] > latest['BB_Mid']:
                        buy_score += 1  # Potential upside breakout
                    else:
                        sell_score += 1  # Potential downside breakout
        except Exception as e:
            print(f"BB analysis error for {symbol}: {e}")
            
        # 5. Stochastic Oscillator
        try:
            if '%K' in latest and '%D' in latest:
                if latest['%K'] < 20 and latest['%K'] > latest['%D']:
                    buy_score += 1  # Stochastic in oversold territory and rising
                elif latest['%K'] > 80 and latest['%K'] < latest['%D']:
                    sell_score += 1  # Stochastic in overbought territory and falling
        except Exception as e:
            print(f"Stochastic analysis error for {symbol}: {e}")
            
        # 6. Volume Analysis
        try:
            if 'Volume_Ratio' in latest:
                if latest['Volume_Ratio'] > 1.5 and latest['Pct_Change'] > 0:
                    buy_score += 1  # High volume on up days
                elif latest['Volume_Ratio'] > 1.5 and latest['Pct_Change'] < 0:
                    sell_score += 1  # High volume on down days
                    
            # On-Balance Volume trend
            if 'OBV' in latest:
                obv_sma = data['OBV'].rolling(window=20).mean()
                if latest['OBV'] > obv_sma.iloc[-1] and prev['OBV'] <= obv_sma.iloc[-2]:
                    buy_score += 1  # OBV crosses above its average
                elif latest['OBV'] < obv_sma.iloc[-1] and prev['OBV'] >= obv_sma.iloc[-2]:
                    sell_score += 1  # OBV crosses below its average
        except Exception as e:
            print(f"Volume analysis error for {symbol}: {e}")
            
        # 7. Price Momentum
        try:
            if 'ROC_5' in latest and 'ROC_20' in latest:
                if latest['ROC_5'] > 0 and latest['ROC_20'] > 0:
                    buy_score += 1  # Positive momentum on multiple timeframes
                elif latest['ROC_5'] < 0 and latest['ROC_20'] < 0:
                    sell_score += 1  # Negative momentum on multiple timeframes
        except Exception as e:
            print(f"Momentum analysis error for {symbol}: {e}")
            
        # 8. Support/Resistance Levels
        try:
            if 'Support_Level' in latest and 'Resistance_Level' in latest:
                # Breakout above resistance
                if prev['Close'] < latest['Resistance_Level'] and latest['Close'] > latest['Resistance_Level']:
                    buy_score += 2
                # Breakdown below support
                elif prev['Close'] > latest['Support_Level'] and latest['Close'] < latest['Support_Level']:
                    sell_score += 2
        except Exception as e:
            print(f"Support/Resistance analysis error for {symbol}: {e}")
            
        # 9. ADX (Trend Strength)
        try:
            if 'ADX' in latest:
                # Strong trend
                if latest['ADX'] > 25:
                    if latest['SMA5'] > latest['SMA20']:
                        buy_score += 1  # Strong uptrend
                    elif latest['SMA5'] < latest['SMA20']:
                        sell_score += 1  # Strong downtrend
        except Exception as e:
            print(f"ADX analysis error for {symbol}: {e}")
            
        # 10. Volatility-based decision
        try:
            if 'Volatility_20' in latest:
                # High volatility might indicate caution
                if latest['Volatility_20'] > 0.4:  # 40% annualized volatility is high
                    # Reduce conviction in both directions
                    buy_score = max(0, buy_score - 1)
                    sell_score = max(0, sell_score - 1)
        except Exception as e:
            print(f"Volatility analysis error for {symbol}: {e}")
            
        # Make final decision based on scores
        rule_signal = 'Hold'
        if buy_score - sell_score >= 3:  # Strong buy signal
            rule_signal = 'Buy'
        elif sell_score - buy_score >= 3:  # Strong sell signal
            rule_signal = 'Sell'
            
        print(f"Rule-based signal for {symbol}: {rule_signal} (Buy: {buy_score}, Sell: {sell_score})")
        
        # Combine model and rule-based signals
        if model_signal == rule_signal:
            # Both systems agree
            return model_signal
        elif model_signal == 'Hold':
            # Model is neutral, use rule-based
            return rule_signal
        elif rule_signal == 'Hold':
            # Rule-based is neutral, use model
            return model_signal
        else:
            # They disagree and neither is neutral, use the rule-based system
            # as it's more transparent and adaptable
            return rule_signal
            
    except Exception as e:
        print(f"Prediction error for {symbol}: {e}")
        return 'Hold'


def execute_bot_trade(symbol, signal, current_price, session):
    """Execute a trade based on the trading bot settings and current signal"""
    try:
        # Get trading bot settings
        bot = session.query(TradingBot).first()
        
        # If bot is not active, don't trade
        if not bot or bot.is_active != 1:
            return
            
        # Get historical data for better decision making
        end_date = datetime.now()
        start_date = end_date - timedelta(days=60)  # Look at last 60 days for more context
        
        try:
            hist_data = yf.Ticker(symbol + ".NS").history(start=start_date, end=end_date)
            if not hist_data.empty:
                # Calculate comprehensive indicators for better decision making
                hist_data = calculate_technical_indicators(hist_data)
                
                # Extract key metrics
                latest = hist_data.iloc[-1] if len(hist_data) > 0 else None
                
                if latest is not None:
                    # Calculate volatility
                    volatility = hist_data['Daily_Return'].std() * 100 if 'Daily_Return' in hist_data.columns else None
                    
                    # Determine market conditions
                    market_conditions = {}
                    
                    # Trend analysis
                    if 'SMA5' in latest and 'SMA20' in latest and 'SMA50' in latest:
                        strong_uptrend = latest['SMA5'] > latest['SMA20'] > latest['SMA50']
                        strong_downtrend = latest['SMA5'] < latest['SMA20'] < latest['SMA50']
                        market_conditions['trend'] = 'strong_up' if strong_uptrend else 'strong_down' if strong_downtrend else 'neutral'
                    
                    # Volatility analysis
                    if volatility is not None:
                        market_conditions['volatility'] = 'high' if volatility > 3 else 'low'
                    
                    # Momentum analysis
                    if 'RSI' in latest:
                        market_conditions['momentum'] = 'overbought' if latest['RSI'] > 70 else 'oversold' if latest['RSI'] < 30 else 'neutral'
                    
                    # Support/Resistance analysis
                    if 'BB_Upper' in latest and 'BB_Lower' in latest:
                        if latest['Close'] > latest['BB_Upper']:
                            market_conditions['price_level'] = 'above_resistance'
                        elif latest['Close'] < latest['BB_Lower']:
                            market_conditions['price_level'] = 'below_support'
                        else:
                            market_conditions['price_level'] = 'within_range'
                    
                    # Volume analysis
                    if 'Volume_Ratio' in latest:
                        market_conditions['volume'] = 'high' if latest['Volume_Ratio'] > 1.5 else 'low' if latest['Volume_Ratio'] < 0.5 else 'normal'
                    
                    print(f"Market conditions for {symbol}: {market_conditions}")
                    
                    # Advanced signal modification based on market conditions
                    if signal == 'Sell':
                        # Don't sell in strong uptrends with low volatility unless overbought
                        if (market_conditions.get('trend') == 'strong_up' and 
                            market_conditions.get('volatility') == 'low' and 
                            market_conditions.get('momentum') != 'overbought'):
                            print(f"Trading bot: Modified signal from Sell to Hold for {symbol} due to strong uptrend with low volatility")
                            signal = 'Hold'
                        
                        # Don't sell when price is at support levels and not in strong downtrend
                        elif (market_conditions.get('price_level') == 'below_support' and 
                              market_conditions.get('trend') != 'strong_down'):
                            print(f"Trading bot: Modified signal from Sell to Hold for {symbol} due to price at support level")
                            signal = 'Hold'
                    
                    elif signal == 'Buy':
                        # Don't buy in strong downtrends with high volatility unless oversold
                        if (market_conditions.get('trend') == 'strong_down' and 
                            market_conditions.get('volatility') == 'high' and 
                            market_conditions.get('momentum') != 'oversold'):
                            print(f"Trading bot: Modified signal from Buy to Hold for {symbol} due to strong downtrend with high volatility")
                            signal = 'Hold'
                        
                        # Don't buy when price is at resistance levels and not in strong uptrend
                        elif (market_conditions.get('price_level') == 'above_resistance' and 
                              market_conditions.get('trend') != 'strong_up'):
                            print(f"Trading bot: Modified signal from Buy to Hold for {symbol} due to price at resistance level")
                            signal = 'Hold'
                        
                        # Don't buy on low volume unless at strong support
                        elif (market_conditions.get('volume') == 'low' and 
                              market_conditions.get('price_level') != 'below_support'):
                            print(f"Trading bot: Modified signal from Buy to Hold for {symbol} due to low volume")
                            signal = 'Hold'
        except Exception as e:
            print(f"Error in advanced market analysis for {symbol}: {e}")
            # Continue with original signal if additional analysis fails
        
        # Get wallet balance
        wallet = session.query(Wallet).first()
        if not wallet:
            print("No wallet found for trading bot")
            return
        
        # Check if we've reached the maximum trades for today
        today = datetime.now().date()
        today_start = datetime.combine(today, datetime.min.time())
        today_end = datetime.combine(today, datetime.max.time())
        
        trades_today = session.query(Transaction).filter(
            Transaction.timestamp.between(today_start, today_end),
            Transaction.type.in_(['buy', 'sell']),
            Transaction.description.like('%[BOT]%')
        ).count()
        
        if trades_today >= bot.max_trades_per_day:
            print(f"Trading bot: Maximum trades per day ({bot.max_trades_per_day}) reached")
            return
        
        # Count current open positions
        open_positions = session.query(Portfolio).all()
        open_position_count = len(open_positions)
        
        # Check if this stock is already in portfolio
        stock_in_portfolio = False
        stock_quantity = 0
        stock_avg_price = 0
        
        for position in open_positions:
            if position.symbol == symbol:
                stock_in_portfolio = True
                stock_quantity += position.quantity
                stock_avg_price = position.buy_price  # Simplified, should calculate weighted average
        
        # Handle BUY signal
        if signal == 'Buy' and not stock_in_portfolio:
            # Check if we've reached max open positions
            if open_position_count >= bot.max_open_positions:
                print(f"Trading bot: Maximum open positions ({bot.max_open_positions}) reached")
                return
            
            # Calculate quantity to buy based on max investment per trade
            max_investment = min(bot.max_investment_per_trade, wallet.balance)
            if max_investment < current_price:
                print(f"Trading bot: Insufficient funds for {symbol}")
                return
                
            quantity = int(max_investment / current_price)
            if quantity <= 0:
                return
                
            total_cost = quantity * current_price
            
            # Execute buy
            wallet.balance -= total_cost
            
            # Add to portfolio
            entry = Portfolio(
                symbol=symbol,
                quantity=quantity,
                buy_price=current_price,
                buy_date=datetime.now()
            )
            session.add(entry)
            
            # Record transaction
            transaction = Transaction(
                transaction_id=str(uuid.uuid4()),
                type='buy',
                amount=total_cost,
                symbol=symbol,
                quantity=quantity,
                price=current_price,
                description=f'[BOT] Bought {quantity} shares of {symbol} at ₹{current_price:.2f} per share',
                timestamp=datetime.now()
            )
            session.add(transaction)
            session.commit()
            
            # Emit trade event
            socketio.emit('trade_executed', {
                'type': 'buy',
                'symbol': symbol,
                'quantity': quantity,
                'price': current_price,
                'total': total_cost,
                'wallet_balance': wallet.balance,
                'timestamp': datetime.now().isoformat(),
                'description': f'[BOT] Bought {quantity} shares of {symbol} at ₹{current_price:.2f} per share'
            })
            
            print(f"Trading bot: Bought {quantity} shares of {symbol} at ₹{current_price:.2f}")
            
        # Handle SELL signal or profit target/stop loss
        elif stock_in_portfolio:
            should_sell = False
            sell_reason = ""
            
            # Check if it's a sell signal
            if signal == 'Sell':
                should_sell = True
                sell_reason = "sell signal"
            
            # Check profit target
            elif current_price >= stock_avg_price * (1 + bot.profit_target_percentage / 100):
                should_sell = True
                sell_reason = f"profit target of {bot.profit_target_percentage}% reached"
            
            # Check stop loss
            elif current_price <= stock_avg_price * (1 - bot.stop_loss_percentage / 100):
                should_sell = True
                sell_reason = f"stop loss of {bot.stop_loss_percentage}% triggered"
            
            if should_sell:
                # Calculate total value
                total_value = stock_quantity * current_price
                
                # Process the sell order - find all entries for this symbol
                entries = session.query(Portfolio).filter_by(symbol=symbol).all()
                for entry in entries:
                    session.delete(entry)
                
                # Add to wallet
                wallet.balance += total_value
                
                # Record transaction
                transaction = Transaction(
                    transaction_id=str(uuid.uuid4()),
                    type='sell',
                    amount=total_value,
                    symbol=symbol,
                    quantity=stock_quantity,
                    price=current_price,
                    description=f'[BOT] Sold {stock_quantity} shares of {symbol} at ₹{current_price:.2f} per share ({sell_reason})',
                    timestamp=datetime.now()
                )
                session.add(transaction)
                session.commit()
                
                # Emit trade event
                socketio.emit('trade_executed', {
                    'type': 'sell',
                    'symbol': symbol,
                    'quantity': stock_quantity,
                    'price': current_price,
                    'total': total_value,
                    'wallet_balance': wallet.balance,
                    'timestamp': datetime.now().isoformat(),
                    'description': f'[BOT] Sold {stock_quantity} shares of {symbol} at ₹{current_price:.2f} per share ({sell_reason})'
                })
                
                print(f"Trading bot: Sold {stock_quantity} shares of {symbol} at ₹{current_price:.2f} ({sell_reason})")
    
    except Exception as e:
        print(f"Trading bot error for {symbol}: {e}")
        session.rollback()


def update_stock_data():
    cache = {}
    while True:
        try:
            with open('stocks.json') as f:
                stocks = json.load(f)
            
            session = Session()
            
            for stock in stocks:
                symbol = stock['symbol']
                for attempt in range(3):
                    try:
                        if symbol not in cache or (datetime.now() - cache[symbol]['timestamp']).seconds > 3600:
                            end_date = datetime.now()
                            start_date = end_date - timedelta(days=365)
                            data = yf.Ticker(symbol + ".NS").history(start=start_date, end=end_date)
                            if data.empty:
                                print(f"No data for {symbol}")
                                break
                            cache[symbol] = {'data': data, 'timestamp': datetime.now()}
                        else:
                            latest = yf.Ticker(symbol + ".NS").history(period='1d')
                            if not latest.empty:
                                cache[symbol]['data'] = pd.concat([cache[symbol]['data'], latest]).drop_duplicates()

                        data = calculate_technical_indicators(cache[symbol]['data'].copy())
                        current_price = round(data['Close'].iloc[-1], 2)
                        signal = predict_signal(symbol, data)
                        
                        # Emit update to clients
                        # Get previous day price if available
                        previous_day_price = None
                        if len(data) > 1:
                            previous_day_price = round(data['Close'].iloc[-2], 2)
                        
                        socketio.emit('stock_update', {
                            'symbol': symbol,
                            'current_price': current_price,
                            'previous_day_price': previous_day_price,
                            'signal': signal
                        }, namespace=None)
                        print(f"Emitted update for {symbol}: ₹{current_price}, Signal: {signal}")
                        
                        # Execute bot trade if applicable
                        execute_bot_trade(symbol, signal, current_price, session)
                        
                        break
                    except Exception as e:
                        print(f"Error fetching {symbol} (attempt {attempt + 1}): {e}")
                        if attempt < 2:
                            time.sleep(2 ** attempt)
                        else:
                            print(f"Failed to fetch {symbol} after 3 attempts")
            
            session.close()
        except Exception as e:
            print(f"Update error: {e}")
            time.sleep(10)
        time.sleep(5)


@app.route('/api/stocks')
def get_stock_list():
    try:
        with open('stocks.json') as f:
            stocks = json.load(f)
        return jsonify(stocks)
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/stock/<symbol>')
def get_stock_data(symbol):
    try:
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        stock = yf.Ticker(symbol + ".NS")
        data = stock.history(start=start_date, end=end_date)
        if data.empty:
            return jsonify({'error': 'No data found for symbol'}), 404

        data = calculate_technical_indicators(data)
        latest_signal = predict_signal(symbol, data)
        prices = [
            {
                'date': str(index.date()),
                'close': round(row['Close'], 2),
                'volume': int(row['Volume']),
                'sma50': round(row['SMA50'], 2) if pd.notna(row['SMA50']) else None,
                'rsi': round(row['RSI'], 2) if pd.notna(row['RSI']) else None,
                'macd': round(row['MACD'], 2) if pd.notna(row['MACD']) else None
            }
            for index, row in data.tail(100).iterrows()
        ]
        current_price = round(data['Close'].iloc[-1], 2)
        return jsonify({
            'prices': prices,
            'current_price': current_price,
            'signal': latest_signal
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/portfolio', methods=['GET', 'POST', 'DELETE'])
def portfolio():
    session = Session()
    try:
        if request.method == 'POST':
            data = request.json
            symbol = data['symbol']
            quantity = int(data['quantity'])
            buy_price = float(data['buy_price'])
            total_cost = quantity * buy_price
            
            # Get wallet
            wallet = session.query(Wallet).first()
            if not wallet:
                wallet = Wallet(balance=0.0)
                session.add(wallet)
                session.commit()
            
            # Check if wallet has enough funds
            if wallet.balance < total_cost:
                return jsonify({
                    'error': f'Insufficient funds in wallet. Required: ₹{total_cost:.2f}, Available: ₹{wallet.balance:.2f}'
                }), 400
            
            # Deduct from wallet
            wallet.balance -= total_cost
            
            # Add to portfolio
            entry = Portfolio(
                symbol=symbol,
                quantity=quantity,
                buy_price=buy_price,
                buy_date=datetime.now()
            )
            session.add(entry)
            
            # Record transaction
            transaction = Transaction(
                transaction_id=str(uuid.uuid4()),
                type='buy',
                amount=total_cost,
                symbol=symbol,
                quantity=quantity,
                price=buy_price,
                description=f'Bought {quantity} shares of {symbol} at ₹{buy_price:.2f} per share',
                timestamp=datetime.now()
            )
            session.add(transaction)
            
            session.commit()
            return jsonify({
                'message': f'Portfolio updated. Bought {quantity} shares of {symbol}',
                'wallet_balance': wallet.balance
            })
        elif request.method == 'DELETE':
            # Delete all entries from the portfolio
            session.query(Portfolio).delete()
            session.commit()
            return jsonify({'message': 'Portfolio cleared successfully'})
        else:
            entries = session.query(Portfolio).all()
            portfolio_data = [
                {
                    'id': e.id,
                    'symbol': e.symbol,
                    'quantity': e.quantity,
                    'buy_price': e.buy_price,
                    'buy_date': str(e.buy_date)
                }
                for e in entries
            ]
            return jsonify(portfolio_data)
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@app.route('/api/wallet', methods=['GET'])
def get_wallet():
    session = Session()
    try:
        wallet = session.query(Wallet).first()
        if not wallet:
            wallet = Wallet(balance=0.0)
            session.add(wallet)
            session.commit()
        
        return jsonify({
            'balance': wallet.balance
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@app.route('/api/wallet/deposit', methods=['POST'])
def deposit_to_wallet():
    session = Session()
    try:
        data = request.json
        amount = float(data['amount'])
        description = data.get('description', 'Deposit to wallet')
        
        if amount <= 0:
            return jsonify({'error': 'Deposit amount must be greater than 0'}), 400
        
        wallet = session.query(Wallet).first()
        if not wallet:
            wallet = Wallet(balance=0.0)
            session.add(wallet)
        
        wallet.balance += amount
        
        # Record transaction
        transaction = Transaction(
            transaction_id=str(uuid.uuid4()),
            type='deposit',
            amount=amount,
            description=description,
            timestamp=datetime.now()
        )
        session.add(transaction)
        session.commit()
        
        # Emit transaction event
        socketio.emit('transaction_executed', {
            'type': 'deposit',
            'amount': amount,
            'wallet_balance': wallet.balance,
            'timestamp': datetime.now().isoformat(),
            'description': description
        })
        
        return jsonify({
            'message': f'Successfully deposited ₹{amount:.2f}',
            'balance': wallet.balance
        })
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@app.route('/api/wallet/withdraw', methods=['POST'])
def withdraw_from_wallet():
    session = Session()
    try:
        data = request.json
        amount = float(data['amount'])
        description = data.get('description', 'Withdrawal from wallet')
        
        if amount <= 0:
            return jsonify({'error': 'Withdrawal amount must be greater than 0'}), 400
        
        wallet = session.query(Wallet).first()
        if not wallet:
            return jsonify({'error': 'Wallet not found'}), 404
        
        if wallet.balance < amount:
            return jsonify({'error': 'Insufficient funds in wallet'}), 400
        
        wallet.balance -= amount
        
        # Record transaction
        transaction = Transaction(
            transaction_id=str(uuid.uuid4()),
            type='withdrawal',
            amount=amount,
            description=description,
            timestamp=datetime.now()
        )
        session.add(transaction)
        session.commit()
        
        # Emit transaction event
        socketio.emit('transaction_executed', {
            'type': 'withdrawal',
            'amount': amount,
            'wallet_balance': wallet.balance,
            'timestamp': datetime.now().isoformat(),
            'description': description
        })
        
        return jsonify({
            'message': f'Successfully withdrew ₹{amount:.2f}',
            'balance': wallet.balance
        })
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@app.route('/api/transactions', methods=['GET'])
def get_transactions():
    session = Session()
    try:
        transactions = session.query(Transaction).order_by(Transaction.timestamp.desc()).all()
        
        transaction_list = [
            {
                'id': t.id,
                'transaction_id': t.transaction_id,
                'type': t.type,
                'amount': t.amount,
                'symbol': t.symbol,
                'quantity': t.quantity,
                'price': t.price,
                'timestamp': t.timestamp.isoformat(),
                'description': t.description
            }
            for t in transactions
        ]
        
        return jsonify(transaction_list)
    except Exception as e:
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@app.route('/api/trading-bot', methods=['GET', 'PUT'])
def trading_bot_settings():
    session = Session()
    try:
        bot = session.query(TradingBot).first()
        
        # Handle reset performance metrics
        if request.method == 'PUT' and request.json.get('reset_performance', False):
            # Delete all bot transactions
            bot_transactions = session.query(Transaction).filter(
                Transaction.description.like('%[BOT]%')
            ).all()
            
            for transaction in bot_transactions:
                session.delete(transaction)
                
            session.commit()
            return jsonify({
                'message': 'Bot performance metrics reset successfully',
                'settings': {
                    'is_active': bot.is_active,
                    'max_investment_per_trade': bot.max_investment_per_trade,
                    'profit_target_percentage': bot.profit_target_percentage,
                    'stop_loss_percentage': bot.stop_loss_percentage,
                    'max_trades_per_day': bot.max_trades_per_day,
                    'max_open_positions': bot.max_open_positions,
                    'last_updated': bot.last_updated.isoformat()
                }
            })
        
        if request.method == 'PUT':
            data = request.json
            
            # Update bot settings
            if 'is_active' in data:
                bot.is_active = int(data['is_active'])
            if 'max_investment_per_trade' in data:
                bot.max_investment_per_trade = float(data['max_investment_per_trade'])
            if 'profit_target_percentage' in data:
                bot.profit_target_percentage = float(data['profit_target_percentage'])
            if 'stop_loss_percentage' in data:
                bot.stop_loss_percentage = float(data['stop_loss_percentage'])
            if 'max_trades_per_day' in data:
                bot.max_trades_per_day = int(data['max_trades_per_day'])
            if 'max_open_positions' in data:
                bot.max_open_positions = int(data['max_open_positions'])
                
            bot.last_updated = datetime.now()
            session.commit()
            
            return jsonify({
                'message': 'Trading bot settings updated successfully',
                'settings': {
                    'is_active': bot.is_active,
                    'max_investment_per_trade': bot.max_investment_per_trade,
                    'profit_target_percentage': bot.profit_target_percentage,
                    'stop_loss_percentage': bot.stop_loss_percentage,
                    'max_trades_per_day': bot.max_trades_per_day,
                    'max_open_positions': bot.max_open_positions,
                    'last_updated': bot.last_updated.isoformat()
                }
            })
        
        # GET request
        return jsonify({
            'is_active': bot.is_active,
            'max_investment_per_trade': bot.max_investment_per_trade,
            'profit_target_percentage': bot.profit_target_percentage,
            'stop_loss_percentage': bot.stop_loss_percentage,
            'max_trades_per_day': bot.max_trades_per_day,
            'max_open_positions': bot.max_open_positions,
            'last_updated': bot.last_updated.isoformat()
        })
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@app.route('/api/trade', methods=['POST'])
def trade():
    session = Session()
    try:
        data = request.json
        symbol = data['symbol']
        action = data['action']  # 'buy' or 'sell'
        quantity = int(data['quantity'])
        current_price = float(data['current_price'])
        
        # Get wallet
        wallet = session.query(Wallet).first()
        if not wallet:
            wallet = Wallet(balance=0.0)
            session.add(wallet)
            session.commit()
        
        total_cost = quantity * current_price
        
        if action == 'buy':
            # Check if wallet has enough funds
            if wallet.balance < total_cost:
                return jsonify({'error': f'Insufficient funds in wallet. Required: ₹{total_cost:.2f}, Available: ₹{wallet.balance:.2f}'}), 400
            
            # Deduct from wallet
            wallet.balance -= total_cost
            
            # Add to portfolio
            entry = Portfolio(
                symbol=symbol,
                quantity=quantity,
                buy_price=current_price,
                buy_date=datetime.now()
            )
            session.add(entry)
            
            # Record transaction
            transaction = Transaction(
                transaction_id=str(uuid.uuid4()),
                type='buy',
                amount=total_cost,
                symbol=symbol,
                quantity=quantity,
                price=current_price,
                description=f'Bought {quantity} shares of {symbol} at ₹{current_price:.2f} per share',
                timestamp=datetime.now()
            )
            session.add(transaction)
            
        elif action == 'sell':
            # Check if user has the stock
            entries = session.query(Portfolio).filter_by(symbol=symbol).all()
            total_quantity = sum(entry.quantity for entry in entries)
            
            if total_quantity < quantity:
                return jsonify({'error': f'Insufficient quantity. You have {total_quantity} shares of {symbol}'}), 400
            
            # Process the sell order
            remaining_to_sell = quantity
            for entry in entries:
                if remaining_to_sell <= 0:
                    break
                    
                if entry.quantity <= remaining_to_sell:
                    # Sell all shares in this entry
                    remaining_to_sell -= entry.quantity
                    session.delete(entry)
                else:
                    # Sell part of the shares in this entry
                    entry.quantity -= remaining_to_sell
                    remaining_to_sell = 0
            
            # Add to wallet
            wallet.balance += total_cost
            
            # Record transaction
            transaction = Transaction(
                transaction_id=str(uuid.uuid4()),
                type='sell',
                amount=total_cost,
                symbol=symbol,
                quantity=quantity,
                price=current_price,
                description=f'Sold {quantity} shares of {symbol} at ₹{current_price:.2f} per share',
                timestamp=datetime.now()
            )
            session.add(transaction)
            
        session.commit()
        
        # Emit trade event
        socketio.emit('trade_executed', {
            'type': action,
            'symbol': symbol,
            'quantity': quantity,
            'price': current_price,
            'total': total_cost,
            'wallet_balance': wallet.balance,
            'timestamp': datetime.now().isoformat(),
            'description': transaction.description
        })
        
        return jsonify({
            'message': f'{action.capitalize()} executed for {symbol}',
            'wallet_balance': wallet.balance
        })
    except Exception as e:
        session.rollback()
        return jsonify({'error': str(e)}), 500
    finally:
        session.close()


@app.route('/')
@app.route('/<path:path>')
def serve_react_app(path='index.html'):
    return send_from_directory(app.static_folder, path)


if __name__ == '__main__':
    threading.Thread(target=update_stock_data, daemon=True).start()
    socketio.run(app, debug=True)
