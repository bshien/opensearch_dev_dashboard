let set = {};



function compare(x){
    set[x+1] = [];
    let start_col = 6;
    
    //console.log(set);
    if(Object.keys(set).length === 2){
        table = document.getElementById("myTable");
        trs = table.getElementsByTagName("tr");

        //console.log(set);
        for(let i = 1; i < trs.length; i++){
            if(i in set){
                tds = trs[i].getElementsByTagName("td")
                for(let j = start_col; j < tds.length; j++){
                    set[i].push(parseFloat(tds[j].innerHTML))
                }
                
            }
            else{
                trs[i].style.display = "none";
            }
        }

        let keys = Object.keys(set);
        comp_list = [];
        for(let i = 0; i < set[keys[0]].length; i++){
            let calc = ((set[keys[1]][i] - set[keys[0]][i]) / set[keys[0]][i]) * 100;
            calc = Math.round(calc * 100) / 100;
            comp_list.push(calc);
        }
        let addtr = document.createElement('tr');
        for(let i = 0; i < set[keys[0]].length + start_col; i++){
            let addtd = document.createElement('td');
            if(i >= start_col){
                addtd.innerHTML = comp_list[i-start_col] + '%';
            }
            
            addtr.appendChild(addtd);
        }
        table.appendChild(addtr);
        //console.log(comp_list);
    }
}

for(let i = 0; i < 5; i++){
    let btn = document.getElementById("btn-" + i);
    btn.addEventListener('click', event => {
        compare(i);
    });
}