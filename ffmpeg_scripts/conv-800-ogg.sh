#!/usr/bin/env bash

origfn=$1

#the shell way
basefn=`basename "$origfn"`
dirname=`dirname "$origfn"`

##the bash way
#basefn=${origfn##*/}
#dirname=${origfn%$basefn}
#dirname=${dirname%/}    #strip off any trailing /
#dirname=${dirname:=.}   #to ensure a non-null dirname

#the bash way
base=${basefn%.*}
ext=${basefn##*.}

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
    newfn=${dirname}/${base}.ogg
elif [[ $# -eq 2 ]]
then
    oext=${2##*.}
    if [ $oext != "ogg" ]
    then
	echo "<dst> is not a file with the .ogg extension" 1>&2
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
    newfn=${dirname}/${base}.DUP$i.ogg

    while [ -f "$newfn" ]
    do
	newfn=${dirname}/${base}.DUP$i.ogg
	i=$(($i+1))
    done
fi

echo NewFN: \"$newfn\"

logfn=$newfn.log

## https://www.virag.si/2012/01/webm-web-video-encoding-tutorial-with-ffmpeg-0-9/
#ffmpeg -i input_file.avi -codec:v libvpx -quality good -cpu-used 0 -b:v 500k -qmin 10 -qmax 42 -maxrate 500k -bufsize 1000k -threads 4 -vf scale=-1:480 -codec:a libvorbis -b:a 128k output.webm

(
    set -x

    time ffmpeg -i "$origfn" -codec:v libtheora -b:v 500k -vf scale=800:-1 -codec:a libvorbis -b:a 128k -y "$newfn"

) 2>&1 | tee "$logfn"
