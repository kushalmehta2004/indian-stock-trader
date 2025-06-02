from flask import Flask, jsonify
import yfinance as yf
import pandas as pd
from datetime import datetime, timedelta

app = Flask(__name__)

def calculate_signals(data):
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    data['SMA200'] = data['Close'].rolling(window=200).mean()
    data['Signal'] = 0
    data.loc[data['SMA50'] > data['SMA200'], 'Signal'] = 1  # Buy
    data.loc[data['SMA50'] < data['SMA200'], 'Signal'] = -1  # Sell
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
        latest_signal = 'Buy' if data['Signal'].iloc[-1] == 1 else 'Sell' if data['Signal'].iloc[-1] == -1 else 'Hold'

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

if __name__ == '__main__':
    app.run(debug=True)
