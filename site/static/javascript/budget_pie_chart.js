let selected = false;

class Category {
  constructor(label, budget, spent) {
    this.label = label;
    this.budget = budget;
    this.spent = spent;
  }
}

class BudgetPieChart {
  constructor(element_id, width, height, dict) {
    this.dict = dict;
    let div = $('#' + element_id);
    div.width(width);
    let canvas = document.createElement('canvas');
    div.append(canvas);
    this.canvas = $(canvas);
    this.cc = canvas.getContext('2d');
    this.cc.canvas.width = width;
    this.cc.canvas.height = height;
    this.data = null;
    this.canvas.mousemove(this._handleMouseMove.bind(this));
    this.canvas.mouseout(this._handleMouseOut.bind(this));
    this.canvas.click(this._handleMouseClick.bind(this));
    this.highlight_idx = null;
    this.cy = this.cc.canvas.height / 2;
    this.cx = Math.min(this.cc.canvas.width / 2, this.cy);
    this.canvas.tooltip({ items: 'canvas', track: true, content: "" });
    this.canvas.tooltip('close');
  }



  draw(data) {
    this.data = [];
    this.total_budget = 0;
    this.max_spend_ratio = 0;
    for (let i = 0; i < data.length; ++i) {
      let row = data[i];
      let cat = new Category(row[0], row[1], row[2]);
      if (cat.budget <= 0) continue;
      this.data.push(cat);
      this.total_budget += cat.budget;
      let spend_ratio = cat.spent / cat.budget;
      this.max_spend_ratio = Math.max(this.max_spend_ratio, spend_ratio)
    }
    this.max_spend_ratio = Math.min(this.max_spend_ratio, 4)
    this.animation = 1;
    this._animate();
    this._displayTransactions();
  }

  _animate() {
    this.animation = Math.min(this.animation + 0.006, 1);
    this._redraw();
    if (this.animation < 1) {
      setTimeout(this._animate.bind(this), 10);
    }
  }

  _getHue(idx) {
    return idx * 5 / 17 * 360 + 240;
  }

  _color(hue, saturation, lightness, alpha) {
    return `hsla(${hue}, ${saturation}%, ${lightness}%, ${alpha})`;
  }

  _unspentColor(hue, highlight = 0) {
    return this._color(hue, 70 + highlight, 60 + highlight, 0.6);
  }

  _spentColor(hue, highlight = 0) {
    return this._color(hue, 50 + highlight, 50 + highlight, 1.0);
  }

  _overspentColor(hue, highlight = 0) {
    return this._color(hue, 70 + highlight, 20 + highlight, 1.0);
  }

  _drawWedge(x, y, r, offset, start_angle, end_angle, fill_color,
    line_color = 'white') {
    let cc = this.cc;
    let med_angle = (start_angle + end_angle) / 360 * Math.PI;
    let cx = x + Math.cos(med_angle) * offset;
    let cy = y + Math.sin(med_angle) * offset;
    cc.beginPath();
    cc.fillStyle = fill_color;
    cc.strokeStyle = line_color;
    cc.lineWidth = 2;
    cc.moveTo(cx, cy);
    cc.arc(cx, cy, r, start_angle / 180 * Math.PI, end_angle / 180 * Math.PI);
    cc.lineTo(cx, cy);
    cc.stroke();
    cc.fill();
  }

  _drawLegend() {
    let row_height = 30;
    let x = this.cx * 2 + 50;
    let y = this.cy - row_height * this.data.length / 2;
    let max_angle = 360;
    if (this.animation < 0.5) {
      max_angle = 360 * this.animation / 0.5 - 90;
    }
    let start_angle = -90;
    for (let i = 0; i < this.data.length; ++i) {
      if (start_angle > max_angle) break;
      let cat = this.data[i];
      let angle = cat.budget / this.total_budget * 360;
      let hue = this._getHue(i);
      let unspent_color = this._color(hue, 70, 60, 0.6);
      let spent_color = this._color(hue, 50, 50, 1);
      this._drawWedge(x, y, 10, 0, 0, 360, this._unspentColor(hue));
      this._drawWedge(x, y, 7, 0, 0, 360, this._spentColor(hue));
      this.cc.fillStyle = 'black';
      this.cc.font = '16px Arial';
      if (this.dict['Categories'][cat.label] != undefined) {
        this.cc.fillText(this.dict['Categories'][cat.label]['Name'], x + 16, y + 5);
      }
      else {
        this.cc.fillText('Empty!', x + 16, y + 5);
      }

      y += row_height;
      start_angle += angle;
    };
  }

  _drawPie() {
    if (this.total_budget <= 0) return;
    let cc = this.cc;
    cc.clearRect(0, 0, cc.canvas.width, cc.canvas.height);
    let offset = 1;
    // Radius of the main circle:
    let r = 0.99 * Math.min(this.cx, this.cy) / Math.max(Math.sqrt(this.max_spend_ratio), 1);
    let start_angle = -90;
    let max_angle = 360;
    let max_spend_ratio_scale = 1;
    if (this.animation < 0.5) {
      max_angle = 360 * this.animation / 0.5 - 90;
      max_spend_ratio_scale = 0;
    }
    if (this.animation < 1) {
      max_spend_ratio_scale = (this.animation - 0.5) / 0.5;
    }
    for (let i = 0; i < this.data.length; ++i) {
      let cat = this.data[i];
      let angle = cat.budget / this.total_budget * 360;
      if (angle + start_angle > max_angle) {
        angle = max_angle - start_angle;
      }
      let hue = this._getHue(i);
      let spend_ratio = Math.min(cat.spent / cat.budget,
        this.max_spend_ratio * max_spend_ratio_scale);
      let spend_radius = r * Math.sqrt(spend_ratio);
      let highlight = 0;
      if (i == this.highlight_idx) highlight = 10;
      let unspent_color = this._unspentColor(hue, highlight);
      let spent_color = this._spentColor(hue, highlight);
      let overspent_color = this._overspentColor(hue, highlight);
      if (spend_ratio < 1) {
        this._drawWedge(this.cx, this.cy, r, offset, start_angle,
          start_angle + angle, unspent_color);
        this._drawWedge(this.cx, this.cy, spend_radius, offset, start_angle,
          start_angle + angle, spent_color);
      } else {
        this._drawWedge(this.cx, this.cy, spend_radius, offset, start_angle,
          start_angle + angle, overspent_color);
        this._drawWedge(this.cx, this.cy, r, offset, start_angle,
          start_angle + angle, spent_color);
      }
      start_angle += angle;
    }

  }

  _redraw() {
    this._drawPie();
    this._drawLegend();
  }

  _handleMouseOut(e) {
    this.highlight_idx = null;
    this._redraw();
    this.canvas.tooltip('close');
  }

  _handleMouseMove(e) {
    if (this.data == null) return;
    let x = e.offsetX;
    let y = e.offsetY;
    let mouse_angle = Math.atan2(y - this.cy, x - this.cx) * 180 / Math.PI;
    if (mouse_angle < -90) mouse_angle += 360;
    let start_angle = -90;
    this.highlight_idx = null;
    for (let i = 0; i < this.data.length; ++i) {
      let cat = this.data[i];
      let angle = cat.budget / this.total_budget * 360;
      if (mouse_angle >= start_angle && mouse_angle < start_angle + angle) {
        this.highlight_idx = i;
        break;
      }
      start_angle += angle;
    }
    if (this.highlight_idx != null) {
      let cat = this.data[this.highlight_idx];
      if (this.dict['Categories'][cat.label] != undefined) {
        this.canvas.tooltip({
          content: `<span class="tip_title">${this.dict['Categories'][cat.label]['Name']}</span><br>Budget: $${cat.budget.toFixed(2)}<br>Spent: $${cat.spent.toFixed(2)}`,
        });
      }
      else {
        this.canvas.tooltip({
          content: `<span class="tip_title">Nothing Here!</span><br>Budget: $0<br>Spent: $0`,
        });
      }
      this.canvas.tooltip('open');
    }
    this._redraw();
  }


  _handleMouseClick(e) {
    if (this.data == null) return;
    let x = e.offsetX;
    let y = e.offsetY;
    let mouse_angle = Math.atan2(y - this.cy, x - this.cx) * 180 / Math.PI;
    if (mouse_angle < -90) mouse_angle += 360;
    let start_angle = -90;
    for (let i = 0; i < this.data.length; ++i) {
      let cat = this.data[i];
      let angle = cat.budget / this.total_budget * 360;
      if (mouse_angle >= start_angle && mouse_angle < start_angle + angle) {
        if (selected == cat) {
          selected = false;
        }
        else {
          selected = cat;
        }
        break;
      }
      start_angle += angle;
    }
    this._displayTransactions(selected["label"]);
  }

  _displayTransactions(cat) {
    var cake = this.dict["Transactions"];
    window.cake = cake;
    var nam;
    var f = document.getElementById("ct");
    f.innerHTML = '';

    if (Object.keys(this.dict["Categories"]).length === 0) {
      var small = `
        <tr>
          <td>
          <form action="/transaction" method = POST>
          <button type="submit" class = "trans" value='' name="info">Add a Transaction Here!</button>
          </td>
          <td></td>  
          <td></td>
          <td></td>
          <td></td>
          <td></td> 
        </tr>      
      `;

      f.innerHTML = small;
      var h = `
        <tr>
          <th>Add a Category First!</th>  
          <th></th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
        </tr>       
      `;
      var e = document.getElementById("hi");
      e.innerHTML = h;
    }

    if ((cat != undefined && this.dict["Categories"][cat]["Transactions"].length === 0) || (cat === undefined && Object.keys(cake).length === 0)) {
      if (cat === undefined) {
        nam = "All Bills";
      }
      else {
        nam = this.dict["Categories"][cat]['Name'];
      }
      var small = `
        <tr>
          <td>
          <form action="/transaction" method = POST>
          <button type="submit" class = "trans" value='' name="info">Add a Transaction Here!</button>
          </td>
          <td></td>  
          <td></td>
          <td></td>
          <td></td>
          <td></td> 
        </tr>      
      `;

      f.innerHTML = small;
    }
    else {
      if (cat === undefined) {
        nam = "All Bills";
        let sorted_cake = sort_date(cake)
        for (let i in sorted_cake) {
          let key = sorted_cake[i][0]
          var large = `
            <tr>
              <td>
              <form action="/transaction" method = POST>
              <button title="Click here to edit your transaction" type="submit" class = "trans" value=`+ key + ` name="info">` + cake[key]['Name'] + `</button>
              </td>
              <td>$`+ cake[key]["Amount"].toFixed(2).toString() + `</td>  
              <td></td>
              <td></td>
              <td></td>
              <td>`+ cake[key]["Date"] + `</td> 
            </tr>      
          `;
          f.innerHTML += large;
        }
      }
      else {
        nam = this.dict['Categories'][cat]['Name'];
        var id = this.dict["Categories"][cat]["Transactions"];
        let sorted_id = sort_date(cake,id)
        console.log("why")
        console.log(sorted_id);
        for (let key in sorted_id) {
          var large = `
            <tr>
              <td>
              <form action="/transaction" method = POST>
              <button title="Click here to edit your transaction" type="submit" class = "trans" value=`+ sorted_id[key][0] + ` name="info">` + cake[sorted_id[key][0]]['Name'] + `</button>
              </td>
              <td>$`+ cake[sorted_id[key][0]]["Amount"].toFixed(2).toString() + `</td>  
              <td></td>
              <td></td>
              <td></td>
              <td>`+ cake[sorted_id[key][0]]["Date"] + `</td> 
            </tr>      
          `;
          f.innerHTML += large;
        }
      }
    }
    var h = `
        <tr>
          <th>`+ nam + `</th>  
          <th></th>
          <th></th>
          <th></th>
          <th></th>
          <th></th>
        </tr>       
      `;
    var e = document.getElementById("hi");
    e.innerHTML = h;
  }
}


function sort_date(dict1, id) {
  if(id != null){
    var items = id.map(function (key) {
    return [key, dict1[key]["Date"]]; });
    console.log("this is id")
    console.log(id)
    console.log(items)
  }
  else{
    var items = Object.keys(dict1).map(function (key) {
    return [key, dict1[key]["Date"]]; });
  }
  items.sort(function (first, second) {
    var d1 = Date.parse(first[1]);
    var d2 = Date.parse(second[1]);
    if(d1>d2) return -1;
    else return 1; 
  });
  return items;
}
