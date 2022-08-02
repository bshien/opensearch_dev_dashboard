const fetch = require('node-fetch');
const express = require('express');
const http = require('http');
const https = require('https');
const yaml = require('js-yaml');
const fs = require('fs');
const app = express();
const port = process.env.PORT || 3000;
let manifest_url = 'https://ci.opensearch.org/ci/dbc/distribution-build-opensearch/2.2.0/5821/linux/x64/tar/builds/opensearch/manifest.yml';

// version in the format of: x.x.x
// build number in the format of: xxxx
function change_manifest_url(build_num, version){
    manifest_url = 'https://ci.opensearch.org/ci/dbc/distribution-build-opensearch/' + version + '/' + build_num + '/linux/x64/tar/builds/opensearch/manifest.yml';
}

function download_manifest(manifest_url, old_res){
    https.get(manifest_url,(res) => {
        const path = `${__dirname}/files/manifest_test.yml`; 
        const filePath = fs.createWriteStream(path);
        res.pipe(filePath);
        filePath.on('finish',() => {
            filePath.close();
            console.log('Download Completed');
            try {
                const manifest_json = yaml.load(fs.readFileSync('files/manifest_test.yml', 'utf8'));
                //console.log(manifest_json);
                old_res.render('new', {manifest_json: manifest_json});
              } catch (e) {
                console.log(e);
            }
        })
    })
}

function convert_build_duration(ms){
    let s = ms/1000;
    let m = s / 60;
    let h = m / 60;
    if(Math.trunc(h) > 0){
        return `${Math.trunc(h)}h ${Math.trunc(m%60)}m ${Math.trunc(s%60)}s`;
    }
    if(Math.trunc(m) > 0){
        return `${Math.trunc(m)}m ${Math.trunc(s%60)}s`;
    }
    return `${Math.trunc(s)}s`; 
}

function yaml_to_json(){
    try {
        const manifest_json = yaml.load(fs.readFileSync('files/manifest_test.yml', 'utf8'));
        console.log(manifest_json);
      } catch (e) {
        console.log(e);
    }
}


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


    for(let i = 0; i < 30; i++){
        let new_url = builds_url + '/' + build_nums[i].build_num.toString() + '/api/json';
        //console.log(new_url);
        let specific_build = await fetch(new_url);
        let build_json = await specific_build.json();
        //console.log(build_json);
        build_nums[i].result = build_json.result;
        build_nums[i].version = build_json.description?.slice(0, build_json.description.indexOf("/"));
        build_nums[i].running = build_json.building ? "Running" : "Done";
        const date = new Date(build_json.timestamp);
        build_nums[i].start_time = date.toLocaleString('en-US', {
            timeZone: 'America/Los_Angeles',
            dateStyle: 'short',
            timeStyle: 'short',
            
        });
        build_nums[i].duration = convert_build_duration(build_json.duration);


    }
    //console.log(build_nums);
    res.render('index', {builds_array: build_nums}); 
}

app.set('view engine', 'ejs');  

app.get('/', function(req, res){
    fetchh(res);
});

app.get('/new/:build_number-:version', function(req, res){
    change_manifest_url(req.params.build_number, req.params.version);
    download_manifest(manifest_url, res);
    
})

app.listen(port, function(){
    console.log(`Example app listening on ${port}!`);
    // download_manifest(manifest_url);
    // yaml_to_json();
});