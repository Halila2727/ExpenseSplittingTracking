from flask import Flask, jsonify
from flask_cors import CORS
import os

# instance of Flask
app = Flask(__name__)

# This is for frontend communication
CORS(app)

# Configuration
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-in-production')

@app.route('/ping', methods=['GET'])
def health_check():
    """
    Health check endpoint to verify the API is running
    """
    return jsonify({
        'status': 'healthy',
        'message': 'Centsible API is running',
        'version': '1.0.0'
    }), 200

@app.route('/', methods=['GET'])
def home():
    """
    Root endpoint with basic API information
    """
    return jsonify({
        'message': 'Welcome to Centsible API',
        'description': 'A cost-sharing application for groups',
        'endpoints': {
            'health_check': '/ping',
            'docs': '/docs (coming soon)'
        }
    }), 200

if __name__ == '__main__':
    # Run the application
    app.run(
        host='0.0.0.0',
        port=5000,
        debug=True
    )
