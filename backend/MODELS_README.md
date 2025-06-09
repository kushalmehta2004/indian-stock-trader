# Stock Trading Model Training & Fine-Tuning

This document explains how to train and fine-tune the machine learning models used for stock trading signals in the application.

## Overview

The system uses machine learning models to predict stock price movements and generate trading signals (Buy, Sell, Hold). The prediction system consists of two parts:

1. **Machine Learning Models**: Trained for each stock to predict future price movements
2. **Rule-Based Technical Analysis**: Acts as a backup system and enhances model predictions

## Available Scripts

The following scripts are available for model management:

### 1. `train_missing_models.py`

This script identifies stocks that don't have trained models and creates new models for them.

```bash
python train_missing_models.py
```

Key features:
- Identifies which stocks are missing models based on the `stocks.json` file
- Fetches historical stock data from Yahoo Finance
- Calculates technical indicators
- Trains a RandomForest classifier model
- Saves models to the `models` directory

### 2. `finetune_models.py`

This script fine-tunes all stock models (existing and new) with enhanced features and more sophisticated prediction targets.

```bash
python finetune_models.py
```

Key features:
- Applies to all stocks in `stocks.json`
- Uses enhanced technical indicators and features
- Tests multiple model types (RandomForest, GradientBoosting)
- Uses a more sophisticated target calculation with multiple timeframes
- Improves model performance with better hyperparameters
- Saves detailed model information including feature list

### 3. `run_model_update.py`

This is a convenience script that runs both the training and fine-tuning processes in sequence.

```bash
python run_model_update.py
```

## Model Structure

The fine-tuned models are saved with the following structure:

```python
model_data = {
    'model': trained_model_object,
    'features': list_of_features_used,
    'performance': f1_score_value,
    'model_type': algorithm_name
}
```

This allows the prediction system to know exactly which features to extract from the price data when making predictions.

## Important Notes

1. **Training Time**: Model training and fine-tuning can take several hours, especially when processing all stocks.

2. **Dependencies**: Ensure all required Python packages are installed:
   ```
   pip install yfinance pandas numpy scikit-learn joblib
   ```

3. **Data Availability**: Some stocks may have limited historical data, which can affect model quality.

4. **Updating Models**: It's recommended to update models periodically (monthly) to incorporate new market data.

## Monitoring Model Performance

After fine-tuning, the script will report the top-performing models based on F1 score. You can monitor model performance in the application by watching the trading signals and outcomes over time.