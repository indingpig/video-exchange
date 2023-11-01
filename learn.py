import requests
import pandas as pd
from bs4 import BeautifulSoup
from config import proxy, headers

res = requests.get('https://www.douyin.com/hot', headers=headers, allow_redirects=False)

print('')
content = res.content
soup = BeautifulSoup(content, 'html.parser')
hot_items = soup.find_all('li', class_="hot-item")
print(hot_items)
print(headers['User-Agent'])

# 4.10 r@r.Eu 12/02 IIi:/  复制打开抖音，看看# 二胎猫咪vs原住民猫咪 猫咪霸凌事件⚠️冤种兄... https://v.douyin.com/idE5h4a7/
