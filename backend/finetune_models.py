import yfinance as yf
import pandas as pd
import numpy as np
from sklearn.ensemble import RandomForestClassifier, GradientBoostingClassifier
from sklearn.svm import SVC
from sklearn.model_selection import train_test_split, GridSearchCV
from sklearn.metrics import classification_report, f1_score
import joblib
from datetime import datetime, timedelta
import json
import os
import glob

def calculate_technical_indicators(data):
    """Calculate technical indicators for the stock data."""
    # Basic indicators from original model
    data['SMA50'] = data['Close'].rolling(window=50).mean()
    data['SMA200'] = data['Close'].rolling(window=200).mean()
    
    # Additional SMAs
    data['SMA5'] = data['Close'].rolling(window=5).mean()
    data['SMA20'] = data['Close'].rolling(window=20).mean()
    
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
    data['MACD_Hist'] = data['MACD'] - data['Signal_Line']
    
    # Bollinger Bands
    data['BB_Mid'] = data['Close'].rolling(window=20).mean()
    data['BB_Std'] = data['Close'].rolling(window=20).std()
    data['BB_Upper'] = data['BB_Mid'] + 2 * data['BB_Std']
    data['BB_Lower'] = data['BB_Mid'] - 2 * data['BB_Std']
    data['BB_Width'] = (data['BB_Upper'] - data['BB_Lower']) / data['BB_Mid']
    
    # Enhanced lagged features
    for lag in range(1, 6):
        data[f'Close_Lag_{lag}'] = data['Close'].shift(lag)
        data[f'Volume_Lag_{lag}'] = data['Volume'].shift(lag)
        # Add price change for each lag
        data[f'Close_Change_{lag}'] = data['Close'] / data[f'Close_Lag_{lag}'] - 1
        
    # Percentage change and volatility
    data['Pct_Change'] = data['Close'].pct_change()
    data['Volatility_20'] = data['Pct_Change'].rolling(window=20).std()
    
    # Stochastic Oscillator
    data['Lowest_14'] = data['Low'].rolling(window=14).min()
    data['Highest_14'] = data['High'].rolling(window=14).max()
    data['%K'] = 100 * ((data['Close'] - data['Lowest_14']) / 
                        (data['Highest_14'] - data['Lowest_14']))
    data['%D'] = data['%K'].rolling(window=3).mean()
    
    # Additional momentum indicators
    data['ROC_5'] = data['Close'].pct_change(periods=5)
    data['ROC_20'] = data['Close'].pct_change(periods=20)
    
    # Volume indicators
    data['Volume_Ratio'] = data['Volume'] / data['Volume'].rolling(window=20).mean()
    
    return data

def prepare_data(symbol):
    """Prepare data for model training with enhanced features."""
    end_date = datetime.now()
    start_date = end_date - timedelta(days=5*365)  # 5 years
    print(f"Fetching data for {symbol} from {start_date.strftime('%Y-%m-%d')} to {end_date.strftime('%Y-%m-%d')}")
    data = yf.Ticker(symbol + ".NS").history(start=start_date, end=end_date)
    if data.empty:
        raise ValueError(f"No data for {symbol}")
    
    print(f"Retrieved {len(data)} rows of data for {symbol}")
    data = calculate_technical_indicators(data)
    
    # More advanced target calculation with multiple timeframes
    for days in [5, 10, 20]:
        data[f'Future_Close_{days}d'] = data['Close'].shift(-days)
        data[f'Return_{days}d'] = data[f'Future_Close_{days}d'] / data['Close'] - 1
    
    # Target calculation: Consensus of multiple timeframes
    data['Target'] = 0
    
    # Short-term (5-day) signal with 2% threshold
    data.loc[data['Return_5d'] > 0.02, 'Target_5d'] = 1  # Buy
    data.loc[data['Return_5d'] < -0.02, 'Target_5d'] = -1  # Sell
    data.loc[(data['Return_5d'] >= -0.02) & (data['Return_5d'] <= 0.02), 'Target_5d'] = 0  # Hold
    
    # Medium-term (10-day) signal with 3% threshold
    data.loc[data['Return_10d'] > 0.03, 'Target_10d'] = 1  # Buy
    data.loc[data['Return_10d'] < -0.03, 'Target_10d'] = -1  # Sell
    data.loc[(data['Return_10d'] >= -0.03) & (data['Return_10d'] <= 0.03), 'Target_10d'] = 0  # Hold
    
    # Long-term (20-day) signal with 5% threshold
    data.loc[data['Return_20d'] > 0.05, 'Target_20d'] = 1  # Buy
    data.loc[data['Return_20d'] < -0.05, 'Target_20d'] = -1  # Sell
    data.loc[(data['Return_20d'] >= -0.05) & (data['Return_20d'] <= 0.05), 'Target_20d'] = 0  # Hold
    
    # Combine signals with more weight on medium-term
    data['Target'] = (data['Target_5d'].fillna(0) + 
                      2 * data['Target_10d'].fillna(0) + 
                      data['Target_20d'].fillna(0))
    
    # Convert to discrete classes: >1 -> Buy, <-1 -> Sell, else Hold
    data.loc[data['Target'] > 1, 'Target'] = 1
    data.loc[data['Target'] < -1, 'Target'] = -1
    data.loc[(data['Target'] >= -1) & (data['Target'] <= 1), 'Target'] = 0
    
    # Enhanced feature set
    base_features = [
        'SMA5', 'SMA20', 'SMA50', 'SMA200', 
        'RSI', 'MACD', 'Signal_Line', 'MACD_Hist',
        'BB_Upper', 'BB_Lower', 'BB_Width',
        'Volatility_20', '%K', '%D',
        'ROC_5', 'ROC_20', 'Volume_Ratio'
    ]
    
    # Add lagged features
    for lag in range(1, 6):
        base_features.extend([f'Close_Lag_{lag}', f'Volume_Lag_{lag}', f'Close_Change_{lag}'])
    
    # Drop rows with NaN values
    data = data.dropna()
    print(f"After data preparation, have {len(data)} usable rows for {symbol}")
    
    # Final features (only use those that exist in the dataframe)
    features = [f for f in base_features if f in data.columns]
    print(f"Using {len(features)} features: {', '.join(features[:5])}...")
    
    X = data[features]
    y = data['Target']
    
    # Print target distribution
    target_counts = data['Target'].value_counts()
    print(f"Target distribution for {symbol}:")
    print(f"Buy signals: {target_counts.get(1, 0)} ({target_counts.get(1, 0)/len(data)*100:.2f}%)")
    print(f"Sell signals: {target_counts.get(-1, 0)} ({target_counts.get(-1, 0)/len(data)*100:.2f}%)")
    print(f"Hold signals: {target_counts.get(0, 0)} ({target_counts.get(0, 0)/len(data)*100:.2f}%)")
    
    return X, y, features

def finetune_model(symbol):
    """Train an improved model for the given stock symbol."""
    X, y, features = prepare_data(symbol)
    X_train, X_test, y_train, y_test = train_test_split(X, y, test_size=0.2, random_state=42)
    
    print(f"Fine-tuning model for {symbol} with {len(X_train)} samples...")
    
    # Try multiple model types
    models = {
        'RandomForest': RandomForestClassifier(n_estimators=100, random_state=42, class_weight='balanced'),
        'GradientBoosting': GradientBoostingClassifier(n_estimators=100, random_state=42)
    }
    
    best_model = None
    best_score = -1
    best_model_name = ""
    
    for name, model in models.items():
        print(f"Training {name} model...")
        model.fit(X_train, y_train)
        
        # Evaluate model
        y_pred = model.predict(X_test)
        report = classification_report(y_test, y_pred, output_dict=True)
        
        # Use macro avg F1 score as the evaluation metric
        f1_macro = report['macro avg']['f1-score']
        print(f"{name} F1 score (macro avg): {f1_macro:.4f}")
        
        if f1_macro > best_score:
            best_score = f1_macro
            best_model = model
            best_model_name = name
    
    print(f"Best model for {symbol}: {best_model_name} with F1 score of {best_score:.4f}")
    
    # Detailed evaluation of the best model
    y_pred = best_model.predict(X_test)
    print(f"Detailed performance of the best model for {symbol}:")
    print(classification_report(y_test, y_pred))
    
    # Feature importance for tree-based models
    if hasattr(best_model, 'feature_importances_'):
        feature_importance = pd.DataFrame({
            'Feature': X.columns,
            'Importance': best_model.feature_importances_
        }).sort_values(by='Importance', ascending=False)
        print(f"Top 10 important features for {symbol}:")
        print(feature_importance.head(10))
    
    # Save the model with information about features used
    model_data = {
        'model': best_model,
        'features': features,
        'performance': best_score,
        'model_type': best_model_name
    }
    model_path = f'models/{symbol}_model.pkl'
    joblib.dump(model_data, model_path)
    print(f"Model saved to {model_path}")
    
    return best_model, best_score

def get_all_stocks():
    """Get list of all stocks from stocks.json."""
    with open('stocks.json') as f:
        stocks = json.load(f)
    return [stock['symbol'] for stock in stocks]

if __name__ == '__main__':
    # Ensure models directory exists
    if not os.path.exists('models'):
        os.makedirs('models')
    
    # Get all stocks
    all_stocks = get_all_stocks()
    print(f"Found {len(all_stocks)} stocks to fine-tune")
    
    # Fine-tune models for all stocks
    successful = 0
    failed = 0
    results = []
    
    for symbol in all_stocks:
        try:
            print(f"\n{'='*60}")
            print(f"Fine-tuning model for {symbol}...")
            print(f"{'='*60}")
            _, score = finetune_model(symbol)
            successful += 1
            results.append((symbol, score))
        except Exception as e:
            print(f"Error fine-tuning model for {symbol}: {str(e)}")
            failed += 1
            results.append((symbol, -1))
    
    # Sort results by performance
    successful_results = [(s, score) for s, score in results if score >= 0]
    successful_results.sort(key=lambda x: x[1], reverse=True)
    
    print(f"\n{'='*60}")
    print(f"Fine-tuning complete. Successfully fine-tuned {successful} models, {failed} failed.")
    print(f"Top 10 performing models:")
    for i, (symbol, score) in enumerate(successful_results[:10], 1):
        print(f"{i}. {symbol}: F1 score = {score:.4f}")
    print(f"{'='*60}")