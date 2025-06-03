from flask import Flask, jsonify, request, send_from_directory
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

app = Flask(__name__, static_folder='static', static_url_path='')
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
        with smtplib.SMTP_SSL('smtp.gmail.com', 465) as smtp:
            smtp.login(EMAIL_ADDRESS, EMAIL_PASSWORD)
            smtp.send_message(msg)
    except Exception as e:
        print(f"Email error: {e}")


def calculate_signals(data):
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    data['SMA200'] = data['Close'].rolling(window=200).mean()
    data['Signal'] = 0
    data.loc[data['SMA50'] > data['SMA200'], 'Signal'] = 1
    data.loc[data['SMA50'] < data['SMA200'], 'Signal'] = -1
    return data


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
        latest_signal = (
            'Buy' if data['Signal'].iloc[-1] == 1
            else 'Sell' if data['Signal'].iloc[-1] == -1
            else 'Hold'
        )
        if latest_signal != 'Hold':
            send_email(
                f"{symbol} Signal",
                f"{latest_signal} {symbol} at ₹{data['Close'].iloc[-1]:.2f}",
                EMAIL_ADDRESS
            )

        prices = [
            {
                'date': str(index.date()),
                'close': round(row['Close'], 2),
                'volume': int(row['Volume']),
                'sma50': round(row['SMA50'], 2) if not pd.isna(row['SMA50']) else None
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
    app.run(debug=True)
