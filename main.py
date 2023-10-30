import os


# print(os.getcwd())
# # print(os.path.abspath(os.path.dirname(os.path.dirname(__file__))))

# path = os.path.abspath(os.path.dirname((os.path.dirname(os.getcwd()))))
# print(path)

# files = os.listdir(path + '/tsTest/beginner')
# print(files)

# for file in files:
#   if not os.path.isdir(file):
#     f = open(path + '/tsTest/beginner/' +  file)
#     lines = f.read()
#     print(lines)
#     f.close()

os.system('whisper -h')