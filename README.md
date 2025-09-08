Roadmap to Role

Purpose
This project is a simple all in one workspace for career growth. It brings your self assessments, resume and LinkedIn prep, interview practice, and productivity tools into one place. The goal is to make it easy for a student or early career professional to plan, take action, and track progress in one site.

Who it is for
Students and career changers who want a clear path to improve their portfolio, resume, LinkedIn, and interview skills without hunting across many tools.

What you can do here
Self Assessment
Explore your strengths, values, interests, and keep a short journal to reflect on what you learn.

Career Tools
Improve your resume and LinkedIn
Practice STAR stories for interviews
Draft an elevator pitch
Organize portfolio and GitHub updates

Resources
Follow simple roadmaps
Use trackers for goals and applications
Learn basic productivity habits you can actually keep

How the app is organized
Home gives a quick overview and links to each section
Self Assessment includes Strengths, Values, Interests, and Journal pages
Career Tools includes Resume and LinkedIn, STAR, Elevator Pitch, and Portfolio and GitHub pages
Resources includes Roadmaps, Trackers, and Productivity pages
About and Contact explain the project and how to reach you

What makes it helpful
One place to plan and act
Short checklists and pages that reduce overwhelm
Mobile friendly and fast
Designed to be extended with new pages later

How to run it locally
Install Node version 18 or newer
Open the project folder in a terminal
Run npm install
Run npm run dev and open the local link shown in the terminal
Run npm run build to create the production files

How to deploy on GitHub Pages
Option one use gh pages
Make sure package.json has predeploy and deploy scripts that publish the dist folder
Run npm run deploy
In GitHub settings set Pages to the gh pages branch

Option two use a docs folder
Run npm run build
Copy the files from the dist folder into a docs folder at the project root
Commit and push
In GitHub settings set Pages to build from main and the docs folder

Common issues and fixes
If refresh on a page shows 404 add a copy of index.html named 404.html in the deployed output
If build says it cannot find index.css check the import path in src main and confirm the file exists
If push is rejected run git pull origin main resolve any changes then push again

Tech used
React and Vite for the app
React Router for pages
Tailwind CSS for layout and styles

Live site
https://eskinder185.github.io/professionaldev/
