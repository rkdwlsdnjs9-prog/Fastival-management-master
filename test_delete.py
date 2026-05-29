import urllib.request
import json

try:
    req = urllib.request.Request("http://localhost:8082/api/goods/list", method="GET")
    with urllib.request.urlopen(req) as res:
        data = json.loads(res.read().decode('utf-8'))
        print("List:", data)
        if len(data) > 0:
            id_to_delete = data[0]['id']
            print(f"Trying to delete ID: {id_to_delete}")
            req_del = urllib.request.Request(f"http://localhost:8082/api/goods/{id_to_delete}", method="DELETE")
            with urllib.request.urlopen(req_del) as res_del:
                print("Delete Status:", res_del.status)
                print("Delete Body:", res_del.read().decode('utf-8'))
except urllib.error.HTTPError as e:
    print("HTTP Error:", e.code)
    print("Error Body:", e.read().decode('utf-8'))
except Exception as e:
    print("Error:", e)
