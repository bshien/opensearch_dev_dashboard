const els = document.querySelectorAll(".result");
//console.log(els);   
for(let i = 0; i < els.length; i++){
    if(els[i].textContent == "SUCCESS"){
        els[i].style.backgroundColor = "green";
    }
    else if(els[i].textContent == "FAILURE"){
        els[i].style.backgroundColor = "red";
    }
}
