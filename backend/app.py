from flask import Flask, jsonify, request, send_from_directory
from flask_socketio import SocketIO
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta
from sqlalchemy import create_engine, Column, Integer, String, Float, DateTime
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import smtplib
from email.mime.text import MIMEText
from dotenv import load_dotenv
import os
from flask_cors import CORS
import json
import threading
import time

app = Flask(__name__, static_folder='static', static_url_path='')
app.config['SECRET_KEY'] = 'secret!'
socketio = SocketIO(app, cors_allowed_origins="*")
CORS(app)
load_dotenv()
Base = declarative_base()
engine = create_engine('sqlite:///data.db')
Session = sessionmaker(bind=engine)

EMAIL_ADDRESS = os.getenv('EMAIL_ADDRESS')
EMAIL_PASSWORD = os.getenv('EMAIL_PASSWORD')

class Portfolio(Base):
    __tablename__ = 'portfolio'
    id = Column(Integer, primary_key=True)
    symbol = Column(String)
    quantity = Column(Integer)
    buy_price = Column(Float)
    buy_date = Column(DateTime)

Base.metadata.create_all(engine)

def send_email(subject, body, to_email):
    try:
        msg = MIMEText(body)
        msg['Subject'] = subject
        msg['From'] = EMAIL_ADDRESS
        msg['To'] = to_email
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as server:
            server.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            server.send_message(msg)
    except Exception as e:
        print(f"Email error: {e}")

def calculate_rsi(data, period=14):
    delta = data['Close'].diff()
    gain = delta.where(delta > 0, 0).rolling(window=period).mean()
    loss = (-delta.where(delta < 0, 0)).rolling(window=period).mean()
    rs = gain / loss
    data['RSI'] = 100 - (100 / (1 + rs))
    return data

def calculate_macd(data):
    exp1 = data['Close'].ewm(span=12, adjust=False).mean()
    exp2 = data['Close'].ewm(span=26, adjust=False).mean()
    data['MACD'] = exp1 - exp2
    data['Signal_Line'] = data['MACD'].ewm(span=9, adjust=False).mean()
    return data

def calculate_signals(data):
    data = calculate_rsi(data)
    data = calculate_macd(data)
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    data['SMA200'] = data['Close'].rolling(window=200).mean()
    data['Signal'] = 0
    data.loc[
        (data['SMA50'] > data['SMA200']) &
        (data['RSI'] < 50) &
        (data['MACD'] > data['Signal_Line']),
        'Signal'
    ] = 1
    data.loc[
        (data['SMA50'] < data['SMA200']) &
        (data['RSI'] > 50) &
        (data['MACD'] < data['Signal_Line']),
        'Signal'
    ] = -1
    return data

def update_stock_prices():
    while True:
        try:
            with open('stocks.json') as f:
                stocks = json.load(f)
            for stock in stocks:
                symbol = stock['symbol']
                for attempt in range(3):
                    try:
                        data = yf.Ticker(symbol + ".NS").history(period='1d')
                        if not data.empty:
                            current_price = round(data['Close'].iloc[-1], 2)
                            print(f"Emitting price for {symbol}: ₹{current_price}")
                            socketio.emit('price_update', {
                                'symbol': symbol,
                                'current_price': current_price
                            }, namespace=None)
                            break
                        else:
                            print(f"No data for {symbol}")
                    except Exception as e:
                        print(f"Error fetching {symbol} (attempt {attempt + 1}): {e}")
                        if attempt < 2:
                            time.sleep(2 ** attempt)
                        else:
                            print(f"Failed to fetch {symbol} after 3 attempts")
            time.sleep(5)
        except Exception as e:
            print(f"Price update error: {e}")
            time.sleep(10)

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

        data = calculate_signals(data)
        latest_signal = 'Buy' if data['Signal'].iloc[-1] == 1 else 'Sell' if data['Signal'].iloc[-1] == -1 else 'Hold'
        if latest_signal == 'Buy':
            send_email(
                f"{symbol} Buy Opportunity",
                f"Buy {symbol} at ₹{data['Close'].iloc[-1]:.2f}",
                EMAIL_ADDRESS
            )

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

@app.route('/api/portfolio', methods=['GET', 'POST'])
def portfolio():
    session = Session()
    try:
        if request.method == 'POST':
            data = request.json
            entry = Portfolio(
                symbol=data['symbol'],
                quantity=data['quantity'],
                buy_price=data['buy_price'],
                buy_date=datetime.now()
            )
            session.add(entry)
            session.commit()
            return jsonify({'message': 'Portfolio updated'})
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

@app.route('/')
@app.route('/<path:path>')
def serve_react_app(path='index.html'):
    return send_from_directory(app.static_folder, path)

if __name__ == '__main__':
    threading.Thread(target=update_stock_prices, daemon=True).start()
    socketio.run(app, debug=True)
