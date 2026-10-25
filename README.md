
# Art Studio Website

## About the Project
This is a full-stack Art Studio website where customers can buy paintings, book wall painting services, and request pottery items. The admin can manage paintings and approve or reject customer requests.

## Features
- User signup and login
- Separate access for customers and admin
- View available paintings and buy paintings
- Cancel painting orders
- Book wall painting services
- Cancel wall painting bookings
- Request pottery items with glaze and quantity selection
- Edit or cancel pottery requests
- Admin can add and manage paintings
- Admin can approve or reject wall painting and pottery requests

## Technologies Used
- Frontend: HTML, CSS, JavaScript
- Backend: Node.js and Express
- Database: MongoDB

## Requirements
- Node.js and npm
- MongoDB running locally or a MongoDB connection URL

## How to Run the Project

1. Clone the repository:
   ```bash
   git clone YOUR_GITHUB_REPOSITORY_URL
   ```

2. Open the project folder:
   ```bash
   cd YOUR_PROJECT_FOLDER
   ```

3. Install the required packages:
   ```bash
   npm install
   ```

4. Create a `.env` file in the root folder and add the required environment variables. Refer to `.env.example`.

5. Make sure MongoDB is running and the database connection is configured correctly.

6. Start the server:
   ```bash
   npm start
   ```

7. Open the local URL shown in the terminal in your browser.

## User Roles

**Customer**
- Browse and buy paintings
- Book wall painting services
- Request pottery items
- View and manage their own orders and requests

**Admin**
- Add and manage paintings
- View customer orders and requests
- Approve or reject wall painting bookings and pottery requests

## Project Status
The main features required for the project have been implemented. Some improvements, such as editing paintings and enforcing the wall booking cancellation cutoff, are still planned.

## Future Improvements
- Improve the user interface
- Add better error messages and loading indicators
- Implement proper HTTP error responses for unauthorized access
- Make the admin dashboard easier to use
