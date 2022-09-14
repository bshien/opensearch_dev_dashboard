let set = {};
let checkbox_selected = [];
let rows_hidden = false; // if the rows are hidden for compare or not
let start_col = 11; // which column to start displaying percent diff, adjust as needed

// handles checkbox functionality
function check_box_handle(x){ // input 'x' represent which button is pressed

    // handle clicking same box
    if(checkbox_selected.includes(x)){
        const index = checkbox_selected.indexOf(x);
        checkbox_selected.splice(index, 1);
    } else { // handle clicking a box
        checkbox_selected.push(x);
    }
    if(checkbox_selected.length === 3){ // handle clicking over 2 boxes
        document.getElementById('btn-' + checkbox_selected[0]).checked = false;
        checkbox_selected = checkbox_selected.slice(1);  
    }
}

// handle compare button
function compare(){

    table = document.getElementById("myTable");
    tbody = document.querySelector("tbody");
    trs = table.getElementsByTagName("tr");

    // if rows hidden, unhide all rows, remove percent diff
    if(rows_hidden){
        for(let i = 1; i < trs.length; i++){
                trs[i].style.display = "";
        }
        const row = document.querySelector("tr:last-child");
        row.remove();
        rows_hidden = false;
        return;
    }

    // add the two checkboxes to an object
    set = {};
    checkbox_selected.forEach(x => {
        set[x+1] = [];
    });

    if(checkbox_selected.length === 2){
        // loop through rows and hide them if not selected
        for(let i = 1; i < trs.length; i++){
            if(i in set){ // if selected

                // add data to array for diff calc
                tds = trs[i].getElementsByTagName("td")
                for(let j = start_col; j < tds.length; j++){
                    set[i].push(parseFloat(tds[j].innerHTML))
                }         
            }
            else{ // not selected
                trs[i].style.display = "none";
            }
        }
        rows_hidden = true;


        let keys = Object.keys(set); // order technically cannot be trusted, better would be to use a Map where you can get exact insertion order, has worked correctly so far though
        
        comp_list = [];

        for(let i = 0; i < set[keys[0]].length; i++){
            let calc = ((set[keys[1]][i] - set[keys[0]][i]) / set[keys[0]][i]) * 100; // diff
            calc = Math.round(calc * 100) / 100; // round
            comp_list.push(calc);
        }

        // add percent diff to display
        let addtr = document.createElement('tr');
        for(let i = 0; i < set[keys[0]].length + start_col; i++){
            let addtd = document.createElement('td');
            if(i >= start_col){
                let val = comp_list[i-start_col];
                if(!isNaN(val)){
                    addtd.innerHTML = val + '%';
                    if(val > 0){
                        addtd.style.color = 'green';
                        addtd.innerHTML = '+' + addtd.innerHTML;
                    }
                    else if(val < 0){
                        addtd.style.color = 'red';
                    }
                }               
            }           
            addtr.appendChild(addtd);
        }
        tbody.appendChild(addtr);
    }
}


// Adds click handler to all checkboxes
let checkboxes = [...document.getElementsByClassName("checkbox")];

for(let i = 0; i < checkboxes.length; i++){
    checkboxes[i].addEventListener('click', event => {
        check_box_handle(i);
    });
}
