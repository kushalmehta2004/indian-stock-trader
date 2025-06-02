from flask import Flask, jsonify
import yfinance as yf
from datetime import datetime, timedelta

app = Flask(__name__)

@app.route('/api/stock/<symbol>')
def get_stock_data(symbol):
    try:
        # Fetch 1 year of daily data
        end_date = datetime.now()
        start_date = end_date - timedelta(days=365)
        stock = yf.Ticker(symbol + ".NS")  # Append .NS for NSE stocks
        data = stock.history(start=start_date, end=end_date)
        if data.empty:
            return jsonify({'error': 'No data found for symbol'}), 404

        # Prepare data for JSON response
        prices = [
            {
                'date': str(index.date()),
                'close': round(row['Close'], 2),
                'volume': int(row['Volume'])
            }
            for index, row in data.tail(100).iterrows()  # Last 100 days for performance
        ]
        current_price = round(data['Close'].iloc[-1], 2)
        return jsonify({
            'prices': prices,
            'current_price': current_price
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500

if __name__ == '__main__':
    app.run(debug=True)
