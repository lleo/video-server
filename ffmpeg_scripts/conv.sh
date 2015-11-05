#!/usr/bin/env bash

origfn=$1

#the shell way
#basefn=`basename $origfn`
#dirname=`dirname $origfn`

#the bash way
basefn=${origfn##*/}
dirname=${origfn%$basefn}
dirname=${dirname%/}    #strip off any trailing /
dirname=${dirname:=.}   #to ensure a non-null dirname

#the bash way
base=${basefn%.*}
ext=${basefn##*.}

##the sed way
#base=`echo $basefn | sed 's/\.[^\.]*$//'`
#ext=`echo $basefn | sed 's/^.*\.//'`

##the awk way
#ext=`echo $basefn | awk -F"." '{print $NF}'`
#base=`basename $basefn $ext`

echo OrigFN  : \"$origfn\"
echo Basename: \"$basefn\"
echo Dirname : \"$dirname\"

echo Base: \"$base\"
echo Ext : \"$ext\"

newfn=${dirname}/${base}.webm

echo NewFN: \"$newfn\"

#ffmpeg -i $1  -s 720x384 -aspect 1.875 -y -f h264 -vcodec libx264 -r 23.976 \
#  $new -f adts -ar 48000 -f wav -ac 2 

echo ffmpeg -i $origfn \
	-codec:v libvpx \
	-quality good \
	-cpu-used 0 \
	-b:v 500k \
	-qmin 10 \
	-qmax 42 \
	-maxrate 500k \
	-bufsize 1000k \
	-threads 8 \
	-vf scale=-1:720 \
	-codec:a libvorbis \
	-b:a 128k \
	$newfn

time ffmpeg -i $origfn \
	-codec:v libvpx \
	-quality good \
	-cpu-used 0 \
	-b:v 500k \
	-qmin 10 \
	-qmax 42 \
	-maxrate 500k \
	-bufsize 1000k \
	-threads 8 \
	-vf scale=-1:720 \
	-codec:a libvorbis \
	-b:a 128k \
	$newfn

