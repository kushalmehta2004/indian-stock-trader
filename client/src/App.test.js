import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';
import axios from 'axios';

// Mock the child components to avoid API calls and rendering issues
jest.mock('./components/StockChart', () => () => <div data-testid="stock-chart">Stock Chart</div>);
jest.mock('./components/PortfolioForm', () => () => <div data-testid="portfolio-form">Portfolio Form</div>);
jest.mock('./components/PortfolioTable', () => () => <div data-testid="portfolio-table">Portfolio Table</div>);

// Mock axios
jest.mock('axios');

test('renders Indian Stock Trader header', () => {
  // Setup mock responses for any API calls
  axios.get.mockResolvedValue({ data: {} });
  
  render(<App />);
  const headerElement = screen.getByText(/Indian Stock Trader/i);
  expect(headerElement).toBeInTheDocument();
});
