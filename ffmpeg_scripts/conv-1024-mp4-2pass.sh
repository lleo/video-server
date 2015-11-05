#!/usr/bin/env bash

origfn=$1

#the shell way
basefn=`basename "$origfn"`
dirname=`dirname "$origfn"`

# #the bash way
# basefn=${origfn##*/}
# dirname=${origfn%$basefn}
# dirname=${dirname%/}    #strip off any trailing /
# dirname=${dirname:=.}   #to ensure a non-null dirname
# #dirname still not good enough eg "origfn=/foo.txt" -> "."

#the bash way
base=${basefn%.*}
ext=${basefn##*.}

base="${base}-2pass"

# #the sed way
# base=`echo $basefn | sed 's/\.[^\.]*$//'`
# ext=`echo $basefn | sed 's/^.*\.//'`

# #the awk way
# ext=`echo $basefn | awk -F"." '{print $NF}'`
# base=`basename $basefn $ext`

echo OrigFN  : \"$origfn\"
echo Basename: \"$basefn\"
echo Dirname : \"$dirname\"

echo Base: \"$base\"
echo Ext : \"$ext\"

if [[ $# -eq 1 ]]
then
    newfn=${dirname}/${base}.mp4
elif [[ $# -eq 2 ]]
then
    oext=${2##.*}
    if [ $oext != "mp4" ]
    then
	echo "<dst> is not a file with the .mp4 extension" 1>&2
	exit 1
    fi
    newfn=$2
else
    echo "\$\# == $#"
    echo "Usage: $0 <src> [<dst>]" 1>&2
    exit 1
fi

if [ "$newfn" = "$origfn" ]
then
    i=1
    newfn=${dirname}/${base}.DUP$i.mp4

    while [ -f "$newfn" ]
    do
	newfn=${dirname}/${base}.DUP$i.mp4
	i=$(($i+1))
    done
fi

echo NewFN: \"$newfn\"

logfn=$newfn.log

## https://www.virag.si/2012/01/web-video-encoding-tutorial-with-ffmpeg-0-9/
##PASS 1
#ffmpeg -i input_file.avi -codec:v libx264 -profile:v high -preset slow -b:v 500k -maxrate 500k -bufsize 1000k -vf scale=-1:480 -threads 0 -pass 1 -an -f mp4 /dev/null
##PASS 2
#ffmpeg -i input_file.avi -codec:v libx264 -profile:v high -preset slow -b:v 500k -maxrate 500k -bufsize 1000k -vf scale=-1:480 -threads 0 -pass 2 -codec:a libfdk_aac -b:a 128k -f mp4 output_file.mp4


time (
    set -x

    #PASS 1
    time ffmpeg -i "$origfn" -codec:v libx264 -profile:v high -preset slow -b:v 700k -maxrate 700k -bufsize 1400k -vf scale=1024:436 -threads 0 -pass 1 -an -f mp4 -y /dev/null

    #PASS 2
    time ffmpeg -i "$origfn" -codec:v libx264 -profile:v high -preset slow -b:v 700k -maxrate 700k -bufsize 1400k -vf scale=1024:346 -threads 0 -pass 2 -codec:a libfdk_aac -b:a 128k -f mp4 -y "$newfn"

) 2>&1 | tee "$logfn"

