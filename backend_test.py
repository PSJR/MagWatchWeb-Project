import requests
import sys
import uuid
from datetime import datetime

class MagWatchWebTester:
    def __init__(self, base_url="https://p2p-stream.preview.emergentagent.com"):
        self.base_url = base_url
        self.api_url = f"{base_url}/api"
        self.token = None
        self.user_data = None
        self.tests_run = 0
        self.tests_passed = 0

    def run_test(self, name, method, endpoint, expected_status, data=None, headers=None):
        """Run a single API test"""
        url = f"{self.api_url}{endpoint}"
        test_headers = {'Content-Type': 'application/json'}
        
        if headers:
            test_headers.update(headers)
        
        if self.token:
            test_headers['Authorization'] = f'Bearer {self.token}'

        self.tests_run += 1
        print(f"\n🔍 Testing {name}...")
        print(f"   URL: {url}")
        
        try:
            if method == 'GET':
                response = requests.get(url, headers=test_headers, timeout=10)
            elif method == 'POST':
                response = requests.post(url, json=data, headers=test_headers, timeout=10)
            elif method == 'PUT':
                response = requests.put(url, json=data, headers=test_headers, timeout=10)
            elif method == 'DELETE':
                response = requests.delete(url, headers=test_headers, timeout=10)

            success = response.status_code == expected_status
            if success:
                self.tests_passed += 1
                print(f"✅ Passed - Status: {response.status_code}")
                try:
                    response_data = response.json()
                    if response_data:
                        print(f"   Response keys: {list(response_data.keys()) if isinstance(response_data, dict) else 'Non-dict response'}")
                except:
                    print(f"   Response: {response.text[:100]}...")
            else:
                print(f"❌ Failed - Expected {expected_status}, got {response.status_code}")
                try:
                    error_data = response.json()
                    print(f"   Error: {error_data}")
                except:
                    print(f"   Raw response: {response.text}")

            return success, response.json() if success and response.text else {}

        except requests.exceptions.RequestException as e:
            print(f"❌ Failed - Network Error: {str(e)}")
            return False, {}
        except Exception as e:
            print(f"❌ Failed - Error: {str(e)}")
            return False, {}

    def test_api_root(self):
        """Test API root endpoint"""
        success, response = self.run_test(
            "API Root",
            "GET",
            "/",
            200
        )
        return success

    def test_register_user(self):
        """Test user registration"""
        # Generate unique user data
        unique_id = str(uuid.uuid4())[:8]
        email = f"test_{unique_id}@magwatch.com"
        
        user_data = {
            "email": email,
            "full_name": f"Test User {unique_id}",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "User Registration",
            "POST",
            "/auth/register",
            200,
            data=user_data
        )
        
        if success and 'access_token' in response:
            self.token = response['access_token']
            self.user_data = response.get('user', {})
            print(f"   Token received: {self.token[:20]}...")
            print(f"   User ID: {self.user_data.get('id')}")
            return True
        return False

    def test_register_duplicate_email(self):
        """Test registration with duplicate email"""
        if not self.user_data:
            print("❌ Skipped - No user data from previous registration")
            return False
            
        duplicate_data = {
            "email": self.user_data.get('email'),
            "full_name": "Duplicate User",
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "Duplicate Email Registration",
            "POST",
            "/auth/register",
            400,
            data=duplicate_data
        )
        return success

    def test_get_user_profile(self):
        """Test getting user profile with JWT token"""
        if not self.token:
            print("❌ Skipped - No token available")
            return False
            
        success, response = self.run_test(
            "Get User Profile",
            "GET",
            "/auth/me",
            200
        )
        
        if success:
            required_fields = ['id', 'email', 'full_name', 'created_at']
            for field in required_fields:
                if field not in response:
                    print(f"❌ Missing required field: {field}")
                    return False
            print(f"   Profile loaded for: {response.get('full_name')}")
        return success

    def test_login_valid_credentials(self):
        """Test login with valid credentials"""
        if not self.user_data:
            print("❌ Skipped - No user data available")
            return False
            
        login_data = {
            "email": self.user_data.get('email'),
            "password": "testpass123"
        }
        
        success, response = self.run_test(
            "Login with Valid Credentials",
            "POST",
            "/auth/login",
            200,
            data=login_data
        )
        
        if success and 'access_token' in response:
            # Update token with new login token
            new_token = response['access_token']
            print(f"   New token received: {new_token[:20]}...")
            return True
        return False

    def test_login_invalid_credentials(self):
        """Test login with invalid credentials"""
        login_data = {
            "email": "nonexistent@test.com",
            "password": "wrongpassword"
        }
        
        success, response = self.run_test(
            "Login with Invalid Credentials",
            "POST",
            "/auth/login",
            401,
            data=login_data
        )
        return success

    def test_profile_without_token(self):
        """Test accessing profile without token"""
        original_token = self.token
        self.token = None
        
        success, response = self.run_test(
            "Profile Access Without Token",
            "GET",
            "/auth/me",
            403  # FastAPI HTTPBearer returns 403 for missing token
        )
        
        # Restore token
        self.token = original_token
        return success

    def test_profile_invalid_token(self):
        """Test accessing profile with invalid token"""
        original_token = self.token
        self.token = "invalid_token_123"
        
        success, response = self.run_test(
            "Profile Access with Invalid Token",
            "GET",
            "/auth/me",
            401
        )
        
        # Restore token
        self.token = original_token
        return success

    def test_history_endpoints(self):
        """Test history endpoints"""
        if not self.token:
            print("❌ Skipped - No token available")
            return False

        # Test adding to history
        history_data = {
            "magnet": "magnet:?xt=urn:btih:test123&dn=Test+Movie",
            "title": "Test Movie"
        }
        
        add_success, add_response = self.run_test(
            "Add History Item",
            "POST",
            "/history",
            200,
            data=history_data
        )
        
        if not add_success:
            return False

        # Test getting history
        get_success, get_response = self.run_test(
            "Get History",
            "GET",
            "/history",
            200
        )
        
        if get_success and isinstance(get_response, list) and len(get_response) > 0:
            print(f"   History items retrieved: {len(get_response)}")
            return True
        
        return get_success

def main():
    print("🚀 Starting MagWatchWeb Backend API Tests")
    print("=" * 50)
    
    tester = MagWatchWebTester()
    
    # Test sequence
    tests = [
        ("API Root", tester.test_api_root),
        ("User Registration", tester.test_register_user),
        ("Duplicate Email Registration", tester.test_register_duplicate_email),
        ("Get User Profile", tester.test_get_user_profile),
        ("Login Valid Credentials", tester.test_login_valid_credentials),
        ("Login Invalid Credentials", tester.test_login_invalid_credentials),
        ("Profile Without Token", tester.test_profile_without_token),
        ("Profile Invalid Token", tester.test_profile_invalid_token),
        ("History Endpoints", tester.test_history_endpoints)
    ]
    
    failed_tests = []
    
    for test_name, test_func in tests:
        try:
            if not test_func():
                failed_tests.append(test_name)
        except Exception as e:
            print(f"❌ Test '{test_name}' threw exception: {str(e)}")
            failed_tests.append(test_name)
    
    # Print results
    print("\n" + "=" * 50)
    print(f"📊 Test Results: {tester.tests_passed}/{tester.tests_run} passed")
    
    if failed_tests:
        print(f"\n❌ Failed Tests:")
        for test in failed_tests:
            print(f"   - {test}")
    else:
        print("\n✅ All tests passed!")
    
    success_rate = (tester.tests_passed / tester.tests_run) * 100 if tester.tests_run > 0 else 0
    print(f"\n📈 Success Rate: {success_rate:.1f}%")
    
    return 0 if success_rate >= 80 else 1

if __name__ == "__main__":
    sys.exit(main())