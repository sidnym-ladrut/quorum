import React, { useCallback, useEffect, useRef, useState, SyntheticEvent } from 'react';
import api from '../api';
import cn from 'classnames';

import debounce from 'lodash.debounce';
import omit from 'lodash.omit';
import pick from 'lodash.pick';

import { FormProvider, useForm } from 'react-hook-form';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { MultiValue } from 'react-select';
import { DotsHorizontalIcon } from '@heroicons/react/solid';
import { Prism as SyntaxHighlighter } from 'react-syntax-highlighter';
import { solarizedlight } from 'react-syntax-highlighter/dist/esm/styles/prism';
import * as Tab from '@radix-ui/react-tabs';
import { genErrorData, ErrorMessage } from '../components/ErrorMessage';
import { Strand } from '../components/Strand';
import { Hero } from '../components/Sections';
import { SelectField, TagField } from '../components/Fields';
import { DropMenu } from '../components/Menus';
import { Spinner, Failer, Nameplate } from '../components/Decals';
import {
  appHost, termRegex, shipRegex,
  mergeDeep, apiScry, apiPoke, useFetch
} from '../utils';

import * as QAPI from '../state/quorum';
import * as Type from '../types/quorum';

// TODO: Abstract forms out into smaller components.
// Form Parameters:
// - Title
// - Dismiss Button
//   - Text
//   - Link
// - Submit Button
//   - Text
//   - Link(s) (onSuccess, onFail)
// - Fields
//   - Short Text Field
//     - Title
//     - Default Text
//   - Long Text Field (Markdown)
//     - Title
//     - Default Text
//     - Default Size
//   - Tags Field
//   - Image Field
//   - Random HTML (For Preview Strand)

///////////////////////////
/// Component Functions ///
///////////////////////////

export const Create = () => {
  const navigate = useNavigate();
  const [tags, setTags] = useState<MultiValue<Type.FieldOption>>([]);
  const [axis, setAxis] = useState<Type.Axis>({join: 'comet', vote: 'comet', post: 'comet'});
  const [image, setImage] = useState<string>('');
  const [sstate, setSState] = useState<SState>('notyet');
  const form = useForm<Type.PokeBoard>({
    defaultValues: {
      name: '',
      desc: '',
      image: '',
      tags: [],
      axis: {join: 'comet', vote: 'comet', post: 'comet'},
    }
  });
  const {register, watch, reset, setValue, handleSubmit} = form;

  const onSubmit = genSubmitFxn(setSState, [tags, axis],
    (values: Type.PokeBoard) =>
      apiPoke<any>({ json: { 'add-board': {
        ...omit(values, ['tags', 'axis']),
        tags: tags.map(t => t.value),
        axis: axis,
      }}}).then(
        (result: any) =>
          navigate(`./../board/${appHost}/${values.name}`, {replace: true})
      )
  );

  const updateImg = useRef(debounce(setImage));
  const img = watch('image');
  useEffect(() => {img && updateImg.current(img);}, [img]);

  return (
    <div className='w-full space-y-6'>
      <header>
        <h1 className='text-2xl font-semibold'>Create Knowledge Board</h1>
      </header>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='flex w-full max-w-full space-x-6'>
            <div className='flex-1 space-y-3'>
              <div className='flex items-center'>
                <div className='flex-1'>
                  <label htmlFor='name' className='text-sm font-semibold'>Name</label>
                  <div className='flex items-center space-x-2'>
                    <input
                      placeholder='board-name'
                      className='flex-1 w-full py-1 px-2 bg-bgp2/30 focus:outline-none focus:ring-2 ring-bgs2 rounded-lg border border-bgp2/30'
                      {...register('name', {required: true, maxLength: 100, pattern: termRegex})}
                    />
                  </div>
                  <ErrorMessage className='mt-1' field="name" messages={genErrorData(100, 'contain only lowercase letters, numbers, and hyphens')}/>
                </div>
              </div>
              <div>
                <label htmlFor='desc' className='text-sm font-semibold'>Description</label>
                <textarea rows={5}
                  placeholder='Insert markdown-compatible text here.'
                  className='align-middle w-full font-mono py-1 px-2 bg-bgp2/30 focus:outline-none focus:ring-2 ring-bgs2 rounded-lg border border-bgp2/30'
                  {...register('desc', {required: true, maxLength: 200})}
                />
                {/*
                <SyntaxHighlighter
                  // children={String(text).replace(/\n$/, '')}
                  children={text}
                  // TODO: Create a style for tailwind css to guarantee matchup??
                  // style={solarizedlight}
                  language="markdown"
                  PreTag="div"
                  className='align-middle max-w-full w-full overflow-x-auto py-1 px-2 ring-bgs2 rounded-lg border border-bgp2/30'
                />
                */}
                <ErrorMessage className='mt-1' field="desc" messages={genErrorData(200)} />
              </div>
              <FormAxis axis={axis} onAxis={setAxis} />
              <div className='flex items-center space-x-6'>
                <div className='flex-1'>
                  <div>
                    <label htmlFor='image' className='text-sm font-semibold'>Image</label>
                    <input type="url" {...register('image', {
                      maxLength: 1024
                    })} className='flex-1 w-full py-1 px-2 bg-bgp2/30 focus:outline-none focus:ring-2 ring-bgs2 rounded-lg border border-bgp2/30' placeholder='https://example.com/image.png' />
                    <ErrorMessage className='mt-1' field="image" messages={genErrorData(1024)}/>
                  </div>
                  <div>
                    <label className='text-sm font-semibold'>Tags</label>
                    <TagField tags={tags} onTags={setTags} />
                    {tags.length === 8 && <div className='text-fgp1/50 text-xs mt-1'>8 tags maximum</div>}
                  </div>
                </div>
                <img className='flex-none object-cover w-28 h-28 mt-4 border-2 border-dashed border-fgp1/60 rounded-lg' src={image || undefined} />
              </div>
              <FormFooter sstate={sstate} dismissLink="/" submitText="Publish" />
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

export const Join = () => {
  const navigate = useNavigate();
  const [sstate, setSState] = useState<SState>('notyet');
  const form = useForm<Type.PokeJoin>({
    defaultValues: {
      host: '',
      name: '',
    }
  });
  const {register, watch, reset, setValue, handleSubmit} = form;

  const onSubmit = genSubmitFxn(setSState, [],
    (values: Type.PokeJoin) =>
      apiPoke<any>({ json: {
        sub: values,
      }}).then((result: any) =>
        apiScry<Type.ScryQuestions>(`/questions/${values.host}/${values.name}`)
      ).then((result: any) =>
        navigate(`./../board/${values.host}/${values.name}`, {replace: true})
      )
  );

  return (
    <div className='w-full space-y-6'>
      <header>
        <h1 className='text-2xl font-semibold'>Join Knowledge Board</h1>
      </header>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='flex w-full space-x-6'>
            <div className='flex-1 space-y-3'>
              <div>
                <label htmlFor='host' className='text-sm font-semibold'>Host Planet</label>
                <div className='flex items-center space-x-2'>
                  <input {...register('host', {required: true, maxLength: 200, pattern: shipRegex})} className='flex-1 w-full py-1 px-2 bg-bgp2/30 focus:outline-none focus:ring-2 ring-bgs2 rounded-lg border border-bgp2/30' placeholder='~sampel-palnet'/>
                </div>
                <ErrorMessage className='mt-1' field="host" messages={genErrorData(200, 'be a valid @p')}/>
              </div>
              <div>
                <label htmlFor='name' className='text-sm font-semibold'>Board Name</label>
                <div className='flex items-center space-x-2'>
                  <input {...register('name', {required: true, maxLength: 100, pattern: termRegex})} className='flex-1 w-full py-1 px-2 bg-bgp2/30 focus:outline-none focus:ring-2 ring-bgs2 rounded-lg border border-bgp2/30' placeholder='board-name'/>
                </div>
                <ErrorMessage className='mt-1' field="name" messages={genErrorData(100, 'contain only lowecase letters, numbers, and hyphens')}/>
              </div>
              <FormFooter sstate={sstate} dismissLink="/" submitText="Join" />
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

export const Question = () => {
  const navigate = useNavigate();
  const {planet, board} = useParams<Type.BoardRoute>();
  const [tags, setTags] = useState<MultiValue<Type.FieldOption>>([]);
  const [sstate, setSState] = useState<SState>('notyet');
  const form = useForm<Type.PokeQuestion>({
    defaultValues: {
      title: '',
      body: '',
      tags: [],
    }
  });
  const {register, watch, reset, setValue, handleSubmit} = form;

  const onSubmit = genSubmitFxn(setSState, [tags],
    (values: Type.PokeQuestion) =>
      apiPoke<any>({ json: { dove: {
        to: planet,
        name: board,
        mail: {
          'add-question': {
            ...omit(values, 'tags'),
            name: board,
            tags: tags.map(t => t.value),
          },
        },
      }}}).then((result: any) =>
        navigate("./..", {replace: true})
      )
  );

  return (
    <div className='w-full space-y-6'>
      <header>
        <h1 className='text-2xl font-semibold'>Submit Question to '{board}'</h1>
      </header>
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className='flex w-full space-x-6'>
            <div className='flex-1 space-y-3'>
              <div>
                <label htmlFor='title' className='text-sm font-semibold'>Title</label>
                <div className='flex items-center space-x-2'>
                  <input {...register('title', {required: true, maxLength: 100})} className='flex-1 w-full font-mono py-1 px-2 bg-bgp2/30 focus:outline-none focus:ring-2 ring-bgs2 rounded-lg border border-bgp2/30' placeholder='Insert markdown-compatible title here.'/>
                </div>
                <ErrorMessage className='mt-1' field="title" messages={genErrorData(100)}/>
              </div>
              <div>
                <label htmlFor='body' className='text-sm font-semibold'>Body</label>
                <textarea {...register('body', {required: true, maxLength: 5000})} rows={5} className='align-middle w-full font-mono py-1 px-2 bg-bgp2/30 focus:outline-none focus:ring-2 ring-bgs2 rounded-lg border border-bgp2/30' placeholder='Insert markdown-compatible text here.' />
                <ErrorMessage className='mt-1' field="body" messages={genErrorData(5000)} />
              </div>
              <div>
                <label className='text-sm font-semibold'>Tags</label>
                <TagField tags={tags} onTags={setTags} />
                {tags.length === 8 && <div className='text-fgp1/50 text-xs mt-1'>8 tags maximum</div>}
              </div>
              <FormFooter sstate={sstate} dismissLink="./.." submitText="Publish" />
            </div>
          </div>
        </form>
      </FormProvider>
    </div>
  );
}

export const Answer = () => {
  const navigate = useNavigate();
  const {planet, board, tid} = useParams<Type.ThreadRoute>();
  const [sstate, setSState] = useState<SState>('notyet');
  const [thread, setThread] = useFetch<Type.Thread, [Type.SetThreadAPI, Type.U<number>]>(
    QAPI.getThread(planet, board, tid), 'set-best', undefined);
  const form = useForm<Type.PokeAnswer>({
    defaultValues: {
      name: '',
      parent: 0,
      body: '',
    }
  });
  const {register, watch, reset, setValue, handleSubmit} = form;

  const Question = useCallback(({fetch}: Type.FetchFxn<Type.Thread>) => {
    const thread: Type.Thread = fetch();
    return (<Strand key={thread.question.id} content={thread.question} />);
  }, []);
  const onSubmit = genSubmitFxn(setSState, [],
    (values: Type.PokeAnswer) =>
      apiPoke<any>({ json: { dove: {
        to: planet,
        name: board,
        mail: {
          'add-answer': {
            body: values.body,
            name: board,
            parent: parseInt(tid || "0"),
          },
        },
      }}}).then((result: any) =>
        navigate("./..", {replace: true})
      )
  );

  return (
    <React.Suspense fallback={<Spinner className='w-24 h-24' />}>
      <div className='w-full space-y-6'>
        <header>
          <h1 className='text-2xl font-semibold'>Submit Answer</h1>
        </header>
        <Question fetch={thread} />
        <FormProvider {...form}>
          <form onSubmit={handleSubmit(onSubmit)}>
            <div className='flex w-full space-x-6'>
              <div className='flex-1 space-y-3'>
                <div>
                  <label htmlFor='body' className='text-sm font-semibold'>Response</label>
                  <textarea {...register('body', {required: true, maxLength: 5000})} rows={5} className='align-middle w-full py-1 px-2 font-mono bg-bgp2/30 focus:outline-none focus:ring-2 ring-bgs2 rounded-lg border border-bgp2/30' placeholder='Insert markdown-compatible text here.' />
                  <ErrorMessage className='mt-1' field="body" messages={genErrorData(5000)} />
                </div>
                <FormFooter sstate={sstate} dismissLink="./.." submitText="Publish" />
              </div>
            </div>
          </form>
        </FormProvider>
      </div>
    </React.Suspense>
  );
}

export const Settings = () => {
  const {planet, board} = useParams<Type.BoardRoute>();
  const [axis, setAxis] = useState<Type.Axis>({join: 'comet', vote: 'comet', post: 'comet'});
  const [perms, setPerms] = useFetch<Type.Perms,
    [Type.SetPermsAPI, Type.U<Type.Axis>, Type.U<string>]>(
    QAPI.getPermissions(planet, board), 'toggle', undefined, undefined);

  const isRemoteBoard: boolean = appHost !== planet;
  const Permissions = useCallback(({fetch}: Type.FetchFxn<Type.Perms>) => {
    const perms: Type.Perms = fetch();
    const axisFields: string[] = ['join', 'vote', 'post'];
    return (
      <React.Fragment>
        <FormAxis axis={pick(perms, axisFields) as Type.Axis} onAxis={
          (state: Type.Axis) =>
            setPerms('toggle',
              mergeDeep(state, omit(perms, axisFields)) as Type.Perms,
              undefined)
          } disabled={isRemoteBoard} className="w-full" />
        <FormMembership perms={perms} onPerms={
          (ship: string, action: Type.SetPermsAPI) =>
            setPerms(action, undefined, ship)
          } disabled={isRemoteBoard} className="w-full" />
      </React.Fragment>
    );
  }, [perms]);

  return (
    <React.Suspense fallback={<Spinner className='w-24 h-24' />}>
      <div className='w-full space-y-6'>
        <header>
          <h1 className='text-2xl font-semibold'>'{board}' Settings</h1>
        </header>
        <Permissions fetch={perms} />
      </div>
    </React.Suspense>
  );
}

//////////////////////
// Helper Functions //
//////////////////////

type SState = 'notyet' | 'pending' | 'error';
type MType = 'members' | 'allowed' | 'banned';

const FormMembership = ({perms, onPerms, disabled = false, className}: {
    perms: Type.Perms,
    onPerms: (ship: string, action: Type.SetPermsAPI) => void,
    disabled: boolean,
    className?: string,
  }) => {
  const isPublic: boolean = (perms.join !== 'invite');
  const memberTypes: MType[] = isPublic ?
    ['members', 'banned'] :
    ['members', 'allowed', 'banned'];

  const MemberAdd = ({type}: {type: MType;}) => {
    const memberType2Action: {[index: string]: Type.SetPermsAPI} = {
      members: 'unban', allowed: 'allow', banned: 'ban' };

    const form = useForm<{ship: string;}>({defaultValues: {ship: ''}});
    const {register, watch, reset, setValue, handleSubmit} = form;
    const onSubmit = useCallback((values: {ship: string;}) => {
      onPerms(values.ship, memberType2Action[type]);
    }, []);

    return (
      <FormProvider {...form}>
        <form onSubmit={handleSubmit(onSubmit)}>
          <div className="flex flex-row">
            <input placeholder='~sampel-palnet'
              {...register('ship', {required: true, maxLength: 200, pattern: shipRegex})}
              className={`w-full flex-1 py-1 px-2 bg-bgp1
                border border-bgp2/30 rounded-l-lg
                ring-bgs2 focus:outline-none focus:ring-2`} />
            <button type="submit" className={`flex items-center rounded-r-lg py-2 px-3
                text-base font-semibold border-2 leading-none transition-colors
                text-bgp1 bg-bgs1 border-bgp1/0 hover:border-bgp1/60`}>
              ➕
            </button>
          </div>
          <ErrorMessage className='mt-1' field="ship"
            messages={genErrorData(200, 'be a valid @p')}/>
        </form>
      </FormProvider>
    );
  };

  const MemberTab = ({type, entries, className}: {
      type: MType;
      entries: string[];
      className?: string;
    }) => {
    const memberType2Items: {[index: string]: (ship: string) => Type.MenuItem[]} = {
      members: (ship: string) => [
        {title: "🚫 ban", click: () => onPerms(ship, "ban")},
      ],
      allowed: (ship: string) => [
        {title: "🚫 ban", click: () => onPerms(ship, "ban")},
        // {title: "🚪 unallow", click: () => onPerms(ship, "unallow")},
      ],
      banned: (ship: string) => [
        {title: "⭕ unban", click: () => onPerms(ship, "unban")},
      ].concat(isPublic ? [] : [
        {title: "🔑 allow", click: () => onPerms(ship, "allow")},
      ]),
    };

    return (
      <Tab.Content value={type}
          className={`p-2 text-fgp1 bg-bgp2/100
            border-x border-b border-bgs1 rounded-b-lg`}>
        {(type !== 'members' && !disabled) && (
          <React.Fragment>
            <MemberAdd type={type} />
            <div className="border-t border-bgs1 mt-2 pt-1" />
          </React.Fragment>
        )}
        {/*FIXME: Improve 'disabled' solution here.*/}
        {(entries.length === 0) ?
          (<div className="flex justify-center">(Board has no {type}!)</div>) :
          entries.map((entry: string) =>
            disabled ? (
              <div key={entry} className={`py-1 px-1
                  flex flex-row flex-wrap
                  place-items-center justify-between
                  hover:bg-bgs1/30`}>
                <Nameplate ship={entry} />
                <div />
              </div>
            ) : (
              <div key={entry} className={`py-1 px-1
                  flex flex-row flex-wrap
                  place-items-center justify-between
                  hover:bg-bgs1/30`}>
                <Nameplate ship={entry} />
                <DropMenu entries={memberType2Items[type](entry)} trigger={(
                  <DotsHorizontalIcon className="h-5 w-5" />
                )} className="hover:cursor-pointer" />
              </div>
            )
          )
        }
      </Tab.Content>
    );
  };

  return (
    <div className={cn("flex-1", className)}>
      <label className='text-sm font-semibold'>Membership</label>
      <Tab.Root defaultValue="members" className="flex flex-col">
        <Tab.List aria-label="Membership Type" className="flex shrink-0 text-lg">
          {memberTypes.map((type: MType, index: number) => (
            <Tab.Trigger key={type} value={type}
                className={cn((index !== 0) ? "border-l" : "",
                  `flex flex-1 py-1 justify-center align-items-center
                  text-fgp1/70 hover:text-fgp1/100 bg-bgp2/30
                  border-t first:border-l last:border-r border-bgs1
                  first:rounded-tl-lg last:rounded-tr-lg
                  aria-selected:text-fgs2 aria-selected:bg-bgp2/100`)}
                >
              {type[0].toUpperCase() + type.substr(1)}
            </Tab.Trigger>
          ))}
        </Tab.List>
        {memberTypes.map((type: MType) => (
          <MemberTab key={type} type={type} entries={perms[type]} />
        ))}
      </Tab.Root>
    </div>
  );
};

const FormAxis = ({axis, onAxis, disabled = false, className}: {
    axis: Type.Axis,
    onAxis: (state: Type.Axis) => void,
    disabled?: boolean,
    className?: string,
  }) => {
  const CompSelect = ({type, options, className}: {
      type: 'join' | 'vote' | 'post';
      options: Type.FieldOption[];
      className?: string;
    }) => (
    <div className={cn('flex-1', className)}>
      <label className='text-xs font-semibold'>
        {type[0].toUpperCase() + type.substr(1)}
      </label>
      {/*FIXME: Improve 'disabled' solution here... really bad to just copy-paste style.*/}
      {disabled ? (
        <div className={`w-full max-h-60 py-2 pl-3 pr-9 z-10
            overflow-auto rounded-md text-base font-semibold bg-bgp2 sm:text-sm`}>
          {options.filter(({label, value}) => value === axis[type])[0].label}
        </div>
        ) : (
        <SelectField options={options}
          selection={axis[type]}
          onSelection={(value: string) => onAxis({...axis, [type]: value})}
          className="w-full" />
        )
      }
    </div>
  );

  const shipOpts: Type.FieldOption[] = [
    {value: 'comet', label: '☄️ comet+'},
    {value: 'moon', label: '🌙  moon+'},
    {value: 'planet', label: '🪐  planet+'},
    {value: 'star', label: '⭐  star+'},
    {value: 'galaxy', label: '🌌  galaxy+'},
  ];
  const joinOpts: Type.FieldOption[] = [
    {value: 'invite', label: '✉️ invite only'},
    ...shipOpts
  ];

  return (
    <div className='flex-1'>
      <label className='text-sm font-semibold'>Permissions</label>
      <div className='flex justify-around items-center space-x-2'>
        <CompSelect type="join" options={joinOpts} />
        <CompSelect type="vote" options={shipOpts} />
        <CompSelect type="post" options={shipOpts} />
      </div>
    </div>
  );
};

const FormFooter = ({sstate, dismissLink, submitText, dismissText, className}: {
    sstate: SState;
    dismissLink: string;
    submitText?: string;
    dismissText?: string;
    className?: string;
  }) => {
  const buttonClass: string = `flex items-center rounded-lg py-2 px-3
    text-base font-semibold border-2 leading-none transition-colors`;
  return (
    <div className='pt-3'>
      <div className='flex justify-between border-t border-bgs1 py-3'>
        <Link to={dismissLink} className={cn(buttonClass,
            'text-bgs1 bg-bgs1/30 border-bgs1/0 hover:border-bgs1')}>
          {dismissText || "Dismiss"}
        </Link>
        {(sstate === 'pending') ? (<Spinner className='w-8 h-8' />) :
          ((sstate === 'error') ? (<Failer className='w-8 h-8' />) :
          (<React.Fragment />))
        }
        <button type="submit" className={cn(buttonClass,
            'text-bgp1 bg-bgs1 border-bgp1/0 hover:border-bgp1/60')}>
          {submitText || "Submit"}
        </button>
      </div>
    </div>
  );
};

function genSubmitFxn<SubmitType>(
    sset: (state: SState) => void,
    mods: any[],
    poke: (args: SubmitType) => Promise<any>,
  ) {
  return useCallback((values: SubmitType) => {
    sset('pending');
    poke(values).catch((error: Error) => {
      console.log(error);
      sset('error');
    });
  }, mods || []);
};
