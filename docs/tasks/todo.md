# TODO

* Implement playwrite integration tests for admin dashboard - cover all cases full coverage

# DONE

* Can you add a flag to mark user as deactivated it should be only visible in the admin dashboars, also on deactive operaiton set this flag to true, on key regeneraiton set it to false, update the admin dashboard list to distinguish the deactivated users. Do not skip deactivated users from stats query - we will use this flag only in the admin dashboard.
* ESC to close modals
* Cleanup old not used admin dashboard code
* In Admin dashboard add random colors for the tags use the colors from the theme - use the same palet as it is used in the main dashboard for the different users charts legent
* Let remove advance filters button and panel, merge the tags filtering in one drop down with checkboiixes - the same used in the main dashboard. Add the other filters in the advance panel next to the tags filter.
* Add all filter sorting arguments to admin dashboard URL like the pageSize
* Let add GET http://localhost:3000/favicon.ico - please add the manifest with all possible fav icon formatts
