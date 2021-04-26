from dotenv import load_dotenv
from flask import Flask, flash, redirect, render_template, request, session, url_for
import os
from pymongo import MongoClient
import uuid
import hashlib
from datetime import datetime, date

load_dotenv()
app = Flask(__name__)
app.secret_key = os.getenv('SECRET_KEY')
#Remember to change password and username for final submit
client = MongoClient(os.getenv('DATABASE_URL'))
db = client.Accounts
collection = db["Data"]
users = {}

#encryption helper function
def encrypt_string(hash_string):
    sha_signature = \
        hashlib.sha256(hash_string.encode()).hexdigest()
    return sha_signature

#Generate left table using data in dictionary
def left_table_gen(data): 
    tags = ['<table class="content-table">',"<thead >", "<tr>"]
    count = 0
    #Get "Categories","Allocated","Spent" Headers
    for i in data.keys():
        tags.append(f"<th>{i}</th>")
        # tags.append(f"<th>{key}</th>")
        if count == 2:
            break
        count += 1 
    tags.append("</tr>")
    tags.append("</thead")
    tags.append("<tbody>")
   
    for i in data["Categories"].keys():
        tags.append("<tr>")
        tags.append(f"<td>{data['Categories'][i]['Name']}</td>")
        if type(data["Categories"][i]) == type({}):
            counter = 0
            for key in data["Categories"][i].keys():
                if key!='Name':
                    tags.append(f'<td>${data["Categories"][i][key]:.2f}</td>')
                    if counter == 1:
                        break
                    counter += 1
        tags.append('</tr>')
        
    #Add Total Category
    tags.append("<tr>")
    tags.append("<td>Total</td>")
    tags.append(f"<td>${data['Spent']:.2f}</td>")
    tags.append(f"<td>${data['Allocated']:.2f}</td>")
    tags.append('</tr>')

    #Close body
    tags.append("</tbody id = tab>") 

    #Add footer button that leads to budget editor
    # tags.append('''
    # <tfoot>
    #     <tr>
    #         <td class='foot'>
                
    #         </td>
    #         <td class='foot'>
    #         </td>
    #         <td class='foot'>
    #         </td>
    #     </tr>
    # </tfoot>
    # ''')      
    tags.append('</table>')
    return("\n".join(tags))

def get_month():
    month = date.today().strftime("%B %Y")
    user_data=collection.find_one({"username":session.get("username")})
    if month != user_data["Month"]:
        user_data["Month"] = month
        user_data["Budget"]["Spent"] = 0
        for category in user_data["Budget"]["Categories"]:
            user_data["Budget"]["Categories"][category]["Spent"]=0
        collection.update_one( {'username':user_data['username']}, {"$set":user_data} )          
    return month
    
def check_month(transaction_string):
    transaction = datetime.strptime(transaction_string, '%Y-%m-%d')
    result = date.today().strftime("%B %Y") == transaction.strftime("%B %Y")
    print(result)
    return result
    
#Welcome Page
@app.route('/')
def home(): 
    if not session.get("username") is None:
        return redirect(url_for("dash"))
    return render_template('index.html')


@app.route("/login")
def login():
    if not session.get("username") is None:
        return redirect(url_for("dash"))
    return render_template('login.html')

@app.route("/logout")
def logout():
    if not session.get("username") is None:
        print("sucessful logout")
        session.pop("username")
    return redirect(url_for("home"))

@app.route("/dash")
def dash():
    if not session.get("username") is None:
        user_data=collection.find_one({"username":session.get("username")})
        return render_template('budget.html',data=user_data, x = left_table_gen(user_data['Budget']), month = get_month())
    return redirect(url_for("home"))

@app.route('/settings')
def settings(): 
    if not session.get("username") is None:
        user_data=collection.find_one({"username":session.get("username")})
        return render_template("settings.html",username = session.get("username"), income = user_data["Income"])
    return redirect(url_for("home"))


@app.route("/signup")
def signup():
    if not session.get("username") is None:
        return redirect(url_for("dash"))
    return render_template('signup.html')

@app.route("/budget_form")
def budget_form():
    if not session.get("username") is None:  
        user_data=collection.find_one({"username":session.get("username")})  
        return render_template('budg_form.html', c = user_data["Budget"]["Categories"])
    return redirect(url_for("home"))


@app.route("/transaction", methods =["POST","GET"])
def transaction():
    if not session.get("username") is None:   
        categories = {}
        user_data=collection.find_one({"username":session.get("username")})
        for category_id in user_data["Budget"]["Categories"].keys():
            categories[category_id] = user_data["Budget"]["Categories"][category_id]["Name"]
        if(request.method == "POST" and request.form["info"]):
            ID = request.form["info"] 
            transaction_data = user_data["Budget"]["Transactions"][ID]
            return render_template('trans_form.html', c = categories.items(), t_id = ID, t = transaction_data)
        return render_template('trans_form.html', c = categories.items())
    return redirect(url_for("home"))

@app.route('/auth', methods = ['POST', 'GET'])
def authorize():
    #Get user info
    session.pop('user_id',None)
    username = request.form['username'].lower()
    password = request.form['password']
    #encrypt password
    password = encrypt_string(password)


    #Check if exists
    if (collection.count_documents( {"username":username,"password":password} )):
        print('Successful Login')
        session["username"] = username
        return redirect(url_for("dash"))

    #Failed attempt
    print('Failed login')
    flash('Invalid Username/Password Combo!')
    return redirect(url_for("login"))

@app.route("/register", methods=['POST'])
def register():
    username = request.form['username'].lower()
    pw1 = request.form['pw1']
    pw2 = request.form['pw2']
    income = float(request.form['income'])
    print('User is trying to register: (' + username + ", " + pw1 + ")")

    #If username exists
    if (collection.count_documents( {"username":username} )):
        print('Username already taken!')
        flash('Username already taken!')
        return redirect(url_for("signup"))
    
    #If passwords do not match
    elif (pw1 != pw2):
        print('Passwords do not match!')
        flash('Passwords do not match!')
        return redirect(url_for("signup"))

    #Succesful Registration
    else:
        #Create default data
        users["username"] = username
        users["password"] = encrypt_string(pw1)
        users['Budget']={}
        users["Budget"]["Categories"]={}
        users["Budget"]["Spent"]=0
        users["Budget"]["Allocated"]=0
        users['Budget']['Transactions']={}
        users['Income']=income
        users['Month'] = date.today().strftime("%B %Y")

        #Insert user to db
        collection.insert_one(users)
        #reset users dict in case of error
        users.clear()
        print('Successfully registered user!')
        flash('Successfully registered user!')
        return redirect(url_for("login"))

@app.route("/store_trans", methods=['POST','GET'])
def store_transaction():
    if "username" in session:
        user_data=collection.find_one({"username":session.get("username")})
        #if a transaction is being edited, delete stuff from original category, and modify spent accordingly
        if(request.form["id"]):
            ID = request.form["id"]
            cat_id = user_data["Budget"]["Transactions"][ID]["Category"]
            if(check_month(user_data["Budget"]["Transactions"][ID]["Date"])):
                user_data["Budget"]["Spent"]-=user_data["Budget"]['Transactions'][ID]["Amount"]
                user_data["Budget"]["Categories"][cat_id]["Spent"]-=user_data["Budget"]['Transactions'][ID]["Amount"]
            user_data["Budget"]["Categories"][cat_id]["Transactions"].remove(ID)
        else:
            ID = str(uuid.uuid4())
    
        #transaction data
        t_name = request.form['t_name']
        cat_id = request.form['t_cat']
        t_date = request.form['t_date']
        t_amt = float(request.form['t_amt'])
        t_note = request.form['t_note']
        
        #setup new category     
        if (request.form["t_newcat"]):
            cat_id = str(uuid.uuid4())
            t_cat = request.form["t_newcat"]
            t_allocate = float(request.form["t_allocate"])
            t_essential = request.form.get("t_essential")
            user_data["Budget"]["Categories"][cat_id]={}
            user_data["Budget"]["Categories"][cat_id]["Name"]=t_cat
            user_data["Budget"]["Categories"][cat_id]["Spent"]=0
            user_data["Budget"]["Categories"][cat_id]["Allocated"]=t_allocate
            user_data["Budget"]["Categories"][cat_id]["Essential"]=t_essential=='on'
            user_data["Budget"]["Categories"][cat_id]["Transactions"]=[]
            user_data["Budget"]["Allocated"]+=t_allocate
  
        #add the transaction
        if(check_month(t_date)):
            user_data["Budget"]["Categories"][cat_id]["Spent"]+=t_amt
            user_data["Budget"]["Spent"]+=t_amt
        user_data["Budget"]["Categories"][cat_id]["Transactions"].append(ID)
        user_data["Budget"]["Transactions"][ID]={}
        user_data["Budget"]["Transactions"][ID]["Name"]=t_name
        user_data["Budget"]["Transactions"][ID]["Category"]=cat_id
        user_data["Budget"]["Transactions"][ID]["Date"] = t_date
        user_data["Budget"]["Transactions"][ID]["Amount"] = t_amt 
        user_data["Budget"]["Transactions"][ID]["Notes"]=t_note

        collection.update_one( {'username':user_data['username']}, {"$set":user_data} )
        return redirect(url_for("dash"))
    return(redirect(url_for("home")))
    
@app.route("/edit_budget", methods =['POST', 'GET'])
def edit_budget():
    if "username" in session:
        user_data=collection.find_one({"username":session.get("username")})
        #number of new categories
        length = int(request.form['index'])
        #try to iterate through a loop of length LEN and add all the info in the form 
        for i in range(length):
            cat = request.form[f'cat_id{i}']
            name = request.form[f'cat{i}']
            allocated = float(request.form[f'all{i}'])
            essential = request.form.get(f'ess{i}')
            try:
                user_data['Budget']['Categories'][cat]['Name'] = name
                user_data['Budget']['Categories'][cat]['Essential']=essential=='on'
                user_data["Budget"]["Allocated"]-=user_data['Budget']['Categories'][cat]['Allocated']
                user_data["Budget"]["Allocated"]+=allocated
                user_data['Budget']['Categories'][cat]['Allocated']=allocated
            except:
                cat = str(uuid.uuid4())
                user_data['Budget']['Categories'][cat]={}
                user_data['Budget']['Categories'][cat]['Name']= name
                user_data['Budget']["Allocated"]+=allocated
                user_data['Budget']['Categories'][cat]['Spent']=0
                user_data['Budget']['Categories'][cat]['Allocated']=allocated
                user_data['Budget']['Categories'][cat]['Essential']=essential=='on'
                user_data['Budget']['Categories'][cat]['Transactions']=[]
        collection.update_one( {'username':user_data['username']}, {"$set":user_data} )
        return redirect(url_for("dash"))
    return redirect(url_for("home"))

@app.route("/handle_settings", methods = ["POST", "GET"])
def handle_settings():
    if "username" in session:
        user_data=collection.find_one({"username":session.get("username")})
        form_type = request.form["form_type"]

        if form_type == "password":
            old_pw = request.form["old_pw"]
            new_pw1 = request.form["new_pw1"]
            new_pw2 = request.form["new_pw2"]
            if encrypt_string(old_pw) == user_data["password"]:
                if new_pw1==new_pw2:
                    if new_pw1 == old_pw:
                        flash("You entered the same password!")
                    else:
                        user_data['password']=encrypt_string(new_pw1)
                        collection.update_one( {'username':user_data['username']}, {"$set":user_data} )
                        flash("Password succesfully changed!")
                #Failed change
                else:
                    flash("Passwords don't match!")
            #Failed change
            else:
                flash("Wrong password!")
                
        elif form_type == "income":
            income = float(request.form["income"])
            user_data["Income"]=income
            collection.update_one( {'username':user_data['username']}, {"$set":user_data} )

        elif form_type == "delete":
            collection.delete_one({"username":session.get("username")})
            return redirect(url_for("logout")) 

        return redirect(url_for("settings"))
    return redirect(url_for("home"))

if __name__ == "__main__":
    app.run(debug=True)
