# 两个视频合成一个，一左一右
# ffmpeg -i screen-1.mov -i screen-2.mov -filter_complex "[0:v]pad=iw*2:ih*1[myname];[myname][1:v]overlay=w" out1.mov

# 16:28
import learn

# print(learn.hex_test(255))
# print(learn.quadratic(2, 3, 1))

