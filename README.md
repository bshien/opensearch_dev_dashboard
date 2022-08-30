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