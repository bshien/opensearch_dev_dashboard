<img src="https://opensearch.org/assets/img/opensearch-logo-themed.svg" height="64px">

# How to run the application

## Install node_modules

To install all the dependencies, run `npm install`.

## Run the application

Run the command `node index.js`, which will start the application at `localhost:3000`.

# High Level Structure

## Overview

On the first directory level, we have all the node essentials: 

- `package.json`
- `package-lock.json`
- `index.js`, the main program
- `views`, containing the EJS files(the markdown for each page)
- `utils`, containing the developer written JS functions.
- `public`, containing the js and css files that will be given to clients and run on the client side
- `build_ymls`, a container for the cached OpenSearch distribution build yml files.
- `dashboard_build_ymls`, a container for the cached OpenSearch Dashboards distribution build yml files.
- `perf_jsons`, a container for the cached performance test json files.

## A note on `build_ymls`, `dashboard_build_ymls`, and `perf_jsons`

These folders can be empty when starting the program, and the latest 30 corresponding distribution builds ymls will be added to each of `build_ymls` and `dashboard_build_ymls`, while the latest 10 performance test jsons will be added to `perf_jsons`.

There is a function named `check_delete` that will remove the files that are not longer within the latest 30 builds or 10 performance tests.

# Each View at a High Level

## Main Page (`index.ejs`)

This page displays the latest 30 OpenSearch distribution builds and their associated information, one on each row. They are ordered chronologically, with the newest build being the first row. There are multiple named columns in this table that give information such as: number, status(whether it is still running), result, version, start time, duration, Integ tests, BWC tests, Commits, CVEs, and Artifacts.

On every page load, it will make a Jenkins API call to get the latest 100 build numbers(it is possible to get more). Of these, the application only displays 30. The application will then loop through each of these build numbers and check if there is a folder with that number as the name: 

- If the folder doesn't exist: it will create this folder, and download the associated buildInfo.yml file and test manifest yml file from Jenkins. To download this file, it will first make a call to the Jenkins build number page to get most importantly if it is running, but also some other information like start time and version for display. If it is done running, it will download the file. 

- If the folder exists: it will attempt to read from the buildInfo.yml file to display information such as: result, version, start time, and duration.