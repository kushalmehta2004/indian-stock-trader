import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import PortfolioForm from '../components/PortfolioForm';
import axios from 'axios';
import { act } from 'react';

jest.mock('axios');

test('renders PortfolioForm and submits data', async () => {
  axios.post.mockResolvedValue({ data: { message: 'Portfolio updated' } });
  
  render(<PortfolioForm />);
  
  const symbolInput = screen.getByPlaceholderText('Symbol');
  const quantityInput = screen.getByPlaceholderText('Quantity');
  const priceInput = screen.getByPlaceholderText('Buy Price');
  const submitButton = screen.getByText('Add');

  // Use act for all state changes
  await act(async () => {
    fireEvent.change(symbolInput, { target: { value: 'RELIANCE' } });
    fireEvent.change(quantityInput, { target: { value: '10' } });
    fireEvent.change(priceInput, { target: { value: '2800' } });
    fireEvent.click(submitButton);
  });

  // Wait for the axios call to complete
  await waitFor(() => {
    expect(axios.post).toHaveBeenCalledWith('http://localhost:5000/api/portfolio', {
      symbol: 'RELIANCE',
      quantity: 10,
      buy_price: 2800,
    });
  });
});
