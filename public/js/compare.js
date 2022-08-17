let set = {};



function compare(x){
    set[x+1] = [];
    
    //console.log(set);
    if(Object.keys(set).length === 2){
        table = document.getElementById("myTable");
        tr = table.getElementsByTagName("tr");

        //console.log(set);
        for(let i = 1; i < tr.length; i++){
            if(i in set){
                tds = tr[i].getElementsByTagName("td")
                for(let j = 5; j < tds.length; j++){
                    set[i].push(parseFloat(tds[j].innerHTML))
                }
                
            }
            else{
                tr[i].style.display = "none";
            }
        }

        let keys = Object.keys(set);
        comp_list = [];
        for(let i = 0; i < set[keys[0]].length; i++){
            comp_list.push((set[keys[1]][i] - set[keys[0]][i]) / set[keys[0]][i]);
        }
        let addtr = document.createElement('tr');
        for(let i = 0; i < set[keys[0]].length + 5; i++){
            let addtd = document.createElement('td');
            if(i >= 5){
                addtd.innerHTML = comp_list[i-5];
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