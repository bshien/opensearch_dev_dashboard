let set = {};
let checkbox_selected = [];
let rows_hidden = false;

function check_box_handle(x){
    if(checkbox_selected.includes(x)){
        const index = checkbox_selected.indexOf(x);
        checkbox_selected.splice(index, 1);
        
        
    } else {
        checkbox_selected.push(x);
    }
    if(checkbox_selected.length === 3){
        document.getElementById('btn-' + checkbox_selected[0]).checked = false;
        checkbox_selected = checkbox_selected.slice(1);
        
    }
    // console.log(checkbox_selected);
}

function compare(){

    table = document.getElementById("myTable");
    trs = table.getElementsByTagName("tr");

    if(rows_hidden){
        for(let i = 1; i < trs.length; i++){
                trs[i].style.display = "";
        }
        rows_hidden = false;
        return;
    }

    set = {};
    checkbox_selected.forEach(x => {
        set[x+1] = [];
    });
    
    let start_col = 12;
    
    //console.log(set);
    if(checkbox_selected.length === 2){
        
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
        rows_hidden = true;

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
                let val = comp_list[i-start_col];
                addtd.innerHTML = val + '%';
                if(val > 0){
                    addtd.style.color = 'green';
                    addtd.innerHTML = '+' + addtd.innerHTML;
                }
                else if(val < 0){
                    addtd.style.color = 'red';
                }
            }
            
            addtr.appendChild(addtd);
        }
        table.appendChild(addtr);
        //console.log(comp_list);
    }
}

for(let i = 0; i < 20; i++){
    let btn = document.getElementById("btn-" + i);
    btn.addEventListener('click', event => {
        check_box_handle(i);
    });
}