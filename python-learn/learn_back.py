from math import sqrt


def hex_test(num):
    str_num = hex(num)
    return str_num


def quadratic(a, b, c):
    # ax2
    if isinstance(a, int) and isinstance(b, int) and isinstance(c, int):
        num1 = (-b + sqrt(b * b - 4 * a * c)) / (2 * a)
        num2 = (-b - sqrt(b * b - 4 * a * c)) / (2 * a)
        return num1, num2


extra = {'city': 'Shenzhen', 'job': 'Engineer'}


def person(name, age, *, city, job):
    print('name:', name, 'age:', age, city, job)


person('Sheldon', 32, **extra)


def trim(s):
    while s[0] == ' ':
        s = s[1:]
    while s[-1] == ' ':
        s = s[:-1]
    return s


print(trim('   hello world  '))


#
# d = {'a': 1, 'b': 2, 'c': 3}
# for key in d:
#     print(key)
#
#
# for value in d.values():
#     print(value)
#
#
# for k, v in d.items():
#     print(k, v)


def findMinAndMax(l):
    if not l:
        return None, None
    min_num = l[0]
    max_num = l[0]
    for num in l:
        if num <= min_num:
            min_num = num
        if num >= max_num:
            max_num = num
    return min_num, max_num


if findMinAndMax([]) != (None, None):
    print('测试失败!')
elif findMinAndMax([7]) != (7, 7):
    print('测试失败!')
elif findMinAndMax([7, 1]) != (1, 7):
    print('测试失败!')
elif findMinAndMax([7, 1, 3, 9, 5]) != (1, 9):
    print('测试失败!')
else:
    print('测试成功!')
