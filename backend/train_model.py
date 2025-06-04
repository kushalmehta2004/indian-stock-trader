import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report
import joblib
from datetime import datetime, timedelta
import json

def calculate_technical_indicators(data):
    # SMA
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    data['SMA200'] = data['Close'].rolling(window=200).mean()
    # RSI
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
    # Bollinger Bands
    data['BB_Mid'] = data['Close'].rolling(window=20).mean()
    data['BB_Std'] = data['Close'].rolling(window=20).std()
    data['BB_Upper'] = data['BB_Mid'] + 2 * data['BB_Std']
    data['BB_Lower'] = data['BB_Mid'] - 2 * data['BB_Std']
    # Lagged features
    for lag in range(1, 6):
        data[f'Close_Lag_{lag}'] = data['Close'].shift(lag)
        data[f'Volume_Lag_{lag}'] = data['Volume'].shift(lag)
    # Percentage change
    data['Pct_Change'] = data['Close'].pct_change()
    return data

def prepare_data(symbol):
    end_date = datetime.now()
    start_date = end_date - timedelta(days=5*365)  # 5 years
    data = yf.Ticker(symbol + ".NS").history(start=start_date, end=end_date)
    if data.empty:
        raise ValueError(f"No data for {symbol}")
    
    data = calculate_technical_indicators(data)
    # Target: Buy if price increases 2% in 5 days, Sell if decreases 2%
    data['Future_Close'] = data['Close'].shift(-5)
    data['Target'] = 0
    data.loc[data['Future_Close'] > data['Close'] * 1.02, 'Target'] = 1  # Buy
    data.loc[data['Future_Close'] < data['Close'] * 0.98, 'Target'] = -1  # Sell
    
    features = [
        'SMA50', 'SMA200', 'RSI', 'MACD', 'Signal_Line', 'BB_Upper', 'BB_Lower',
        'Close_Lag_1', 'Close_Lag_2', 'Close_Lag_3', 'Close_Lag_4', 'Close_Lag_5',
        'Volume_Lag_1', 'Volume_Lag_2', 'Volume_Lag_3', 'Volume_Lag_4', 'Volume_Lag_5',
        'Pct_Change'
    ]
    data = data.dropna()
    X = data[features]
    y = data['Target']
    return X, y

def train_model(symbol):
    X, y = prepare_data(symbol)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    model = RandomForestClassifier(n_estimators=100, random_state=42)
    model.fit(X_train, y_train)
    
    print(f"Model performance for {symbol}:")
    print(classification_report(y_test, model.predict(X_test)))
    
    joblib.dump(model, f'models/{symbol}_model.pkl')
    return model

if __name__ == '__main__':
    with open('stocks.json') as f:
        stocks = json.load(f)
    
    import os
    if not os.path.exists('models'):
        os.makedirs('models')
    
    for stock in stocks:
        symbol = stock['symbol']
        try:
            print(f"Training model for {symbol}...")
            train_model(symbol)
        except Exception as e:
            print(f"Error training model for {symbol}: {e}")
