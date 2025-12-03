import unittest

from app import extract_amount_from_line, find_total_amount_in_text


class ReceiptOcrParsingTests(unittest.TestCase):
    def test_extract_amount_from_line_parses_currency(self):
        line = "Grand Total: $123.45"
        self.assertEqual(extract_amount_from_line(line), 123.45)

    def test_extract_amount_from_line_handles_commas(self):
        line = "Amount Due 1,234.56"
        self.assertEqual(extract_amount_from_line(line), 1234.56)

    def test_find_total_prefers_keyword_line(self):
        text = """
        Items: $10.00
        Balance Due: $88.11
        Thank you!
        """
        self.assertEqual(find_total_amount_in_text(text), 88.11)

    def test_find_total_falls_back_to_next_line(self):
        text = """
        Total Amount
        $77.00
        """
        self.assertEqual(find_total_amount_in_text(text), 77.0)

    def test_find_total_ignores_subtotal(self):
        text = """
        Item 1: $10.00
        Item 2: $15.50
        Subtotal: $25.50
        Tax: $2.00
        Total: $27.50
        """
        self.assertEqual(find_total_amount_in_text(text), 27.50)

    def test_find_total_ignores_subtotal_variations(self):
        text = """
        Items: $50.00
        Sub-Total: $50.00
        Tax: $4.00
        Grand Total: $54.00
        """
        self.assertEqual(find_total_amount_in_text(text), 54.0)


if __name__ == '__main__':
    unittest.main()

