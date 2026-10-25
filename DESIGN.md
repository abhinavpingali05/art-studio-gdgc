## 1. How do login and the two roles work?

The Art Studio website has a login and registration system with two roles: Customer and Admin.
- Customer: A customer can register, log in, browse paintings, purchase available paintings, view orders, and request wall painting services or pottery.
- Admin: The admin manages the website. The admin can add or manage paintings, view customer orders, and handle wall painting and pottery requests.

The login verifies who the user is and the role of the user determines the actions they are allowed to perform

## 2. Which database did you choose, and why?

I chose MongoDB Atlas because it is cloud-hosted and works with JavaScript and Mongoose. It is much more flexible making it convinient to use for my website built using Node.js and JavaScript.

## 3. How do you stop two people from taking the same painting or date?

To prevent 2 people from buying the same paintig or choosing a conflicting date I ensured that whenever 2 people A and B are seeing the same painting, whoever clicks on purchase painting first gets to purchase it and this is updated in real-time and hence the website is refreshed to sold on that particular item making person B ineligible to purchase it.

## 4. What did you finish, what did you leave out, and what would you do next?

- Completed: Login and roles, painting gallery and search, purchases and orders, wall painting   requests, pottery section, admin management, MongoDB integration, and UI improvements.

While i was able to complete all the core features asked for in teh document in the given time-frame, had there been more time i would have worked more on implementing the 3-day cutoff for cancellations along with admins ability to  not only add new paintings but also to edit existing ones and add strict http error handling.

next i would finish up on all the missing elements while focussing on the ui/ux design to make it more user friendly.



