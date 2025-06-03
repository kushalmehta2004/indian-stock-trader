import unittest
import requests

class TestAPI(unittest.TestCase):
    BASE_URL = 'http://localhost:5000'

    def test_stock_valid(self):
        response = requests.get(f'{self.BASE_URL}/api/stock/RELIANCE')
        self.assertEqual(response.status_code, 200)
        data = response.json()
        self.assertIn('prices', data)
        self.assertIn('current_price', data)
        self.assertIn('signal', data)

    def test_stock_invalid(self):
        response = requests.get(f'{self.BASE_URL}/api/stock/INVALID')
        self.assertEqual(response.status_code, 404)

    def test_portfolio_post(self):
        payload = {'symbol': 'RELIANCE', 'quantity': 5, 'buy_price': 2750}
        response = requests.post(f'{self.BASE_URL}/api/portfolio', json=payload)
        self.assertEqual(response.status_code, 200)
        self.assertEqual(response.json()['message'], 'Portfolio updated')

    def test_portfolio_get(self):
        response = requests.get(f'{self.BASE_URL}/api/portfolio')
        self.assertEqual(response.status_code, 200)
        self.assertIsInstance(response.json(), list)

if __name__ == '__main__':
    unittest.main()
