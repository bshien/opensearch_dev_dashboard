const fetch = require('node-fetch');
const express = require('express');
const http = require('http');
const https = require('https');
const yaml = require('js-yaml');
const fs = require('fs');
const app = express();
const port = 3000;
//const ran = 3;

let yaml_parse = async (url) =>{
    const yamlSchema = await fetch(url, {
        method: 'GET',
        headers: {
            'Content-Type': 'application/json',
        }
    }).then(res => res.body);
    //const jsonSchema = yaml.load(yamlSchema);
    //const yamljson = await yamlSchema.json()
    console.log(yamlSchema);
}


// URL of the manifest
const manifest_url = 'https://ci.opensearch.org/ci/dbc/distribution-build-opensearch/2.2.0/5821/linux/x64/tar/builds/opensearch/manifest.yml';

let build_nums = []

let fetchh = async (res) => {

    let builds_url = 'https://build.ci.opensearch.org/job/distribution-build-opensearch';
    //let jobs = await fetch('https://build.ci.opensearch.org/job/distribution-build-opensearch/api/json?tree=allBuilds[number,url]');
    let jobs = await fetch(builds_url + '/api/json');

    let jobs_json = await jobs.json();
    build_nums = []
    jobs_json.builds.forEach(build => {
        build_nums.push({build_num: build.number});

    });
    // jobs_json.allBuilds.forEach(build => build_nums.push(build.number));

    //console.log(build_nums);

    for(let i = 0; i < 10; i++){
        let new_url = builds_url + '/' + build_nums[i].build_num.toString() + '/api/json';
        console.log(new_url);
        let specific_build = await fetch(new_url);
        let build_json = await specific_build.json();
        console.log(build_json);
        build_nums[i].result = build_json.result;
        build_nums[i].version = build_json.description.slice(0, build_json.description.indexOf("/"));
        build_nums[i].running = build_json.building ? "Running" : "Done";


    }
    console.log(build_nums);
    //console.log(jobs_json);
    res.render('index', {builds_array: build_nums}); 
    //console.log(await(await fetch('https://build.ci.opensearch.org/job/distribution-build-opensearch/api/json')).json());
}

app.set('view engine', 'ejs');  

app.get('/', function(req, res){
    //res.send('Hello World!');
    fetchh(res);
    //res.render('index', {ran: build_nums }); 
});

app.get('/new', function(req, res){
    res.render('new');
})

app.listen(port, function(){
    console.log(`Example app listening on ${port}!`);
    //const mani = yaml.load(fs.readFileSync('manifest.yml', 'utf8'));
    //console.log(mani);
    //yaml_parse("https://ci.opensearch.org/ci/dbc/distribution-build-opensearch/2.2.0/5821/linux/x64/tar/builds/opensearch/manifest.yml")
    https.get(manifest_url,(res) => {
        // Image will be stored at this path
        const path = `${__dirname}/files/manifest_test.yml`; 
        const filePath = fs.createWriteStream(path);
        res.pipe(filePath);
        filePath.on('finish',() => {
            filePath.close();
            console.log('Download Completed'); 
        })
    })
    //fetchh();
});